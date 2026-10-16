// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function totalSupply() external view returns (uint256);
}

/**
 * @title ProtoFeeSplitter
 * @notice Per-token fee router for Proto tokens on any chain. The quote currency is either native
 *         (`quoteAsset == address(0)`, e.g. ETH on Robinhood) or an ERC-20 (e.g. USDC on Arc).
 *           1. `protocolBps` of every fee goes to the protocol treasury first.
 *           2. The remainder is split holders / burn (buyback-and-burn via `buybackVault`) /
 *              creator / liquidity
 *              (`holdersBps + burnBps + creatorBps + liquidityBps == 10_000`).
 *
 *         Holder dividends are streamed linearly over STREAM_DURATION and accrue pro-rata to
 *         circulating supply. LaunchpadToken checkpoints both sides of every transfer via
 *         `setShare`, so a holder only earns while holding; streaming stops flash buyers from
 *         capturing a fee deposit they trigger themselves (fee collection is permissionless).
 *         The creator share is pulled by the creator, so a creator that cannot receive funds
 *         can never block swaps. The creator may redirect its payout (e.g. a community takeover)
 *         through a 48h propose/accept timelock. Splits are fixed at construction.
 */
contract ProtoFeeSplitter {
    struct Split {
        uint16 protocolBps;
        uint16 holdersBps;
        uint16 burnBps;
        uint16 creatorBps;
        uint16 liquidityBps;
    }

    struct Config {
        address token;
        address quoteAsset;
        address hook;
        address factory;
        address poolManager;
        address excluded;
        address treasury;
        address buybackVault;
        address liquidityVault;
        address creator;
    }

    uint256 private constant PRECISION = 1e36;
    uint256 private constant BPS = 10_000;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    uint256 public constant STREAM_DURATION = 1 days;
    uint256 public constant RECIPIENT_TIMELOCK = 48 hours;

    address public immutable token;
    /// @dev address(0) = native currency.
    address public immutable quoteAsset;
    address public immutable hook;
    address public immutable factory;
    /// @dev Holds pool liquidity; excluded from circulating supply.
    address public immutable poolManager;
    /// @dev Optional extra non-circulating holder (e.g. the bonding curve); may be address(0).
    address public immutable excluded;
    address public immutable treasury;
    address public immutable buybackVault;
    address public immutable liquidityVault;
    address public immutable creator;

    uint16 public immutable protocolBps;
    uint16 public immutable holdersBps;
    uint16 public immutable burnBps;
    uint16 public immutable creatorBps;
    uint16 public immutable liquidityBps;

    // Holder dividend stream (Synthetix-style, total = circulating supply).
    uint256 public rewardRate; // quote units * PRECISION per second
    uint256 public periodFinish;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalStreamed;

    uint256 public creatorAccrued;
    /// @notice Burn share awaiting a TWAP-guarded buyback-and-burn (pulled by `buybackVault`).
    uint256 public buybackAccrued;
    /// @notice Where creator fees are paid; starts as `creator`.
    address public creatorRecipient;
    address public pendingCreatorRecipient;
    uint256 public pendingCreatorRecipientValidAfter;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userEarned;

    event FeesReceived(
        uint256 total,
        uint256 protocolAmount,
        uint256 holdersAmount,
        uint256 burnAmount,
        uint256 creatorAmount,
        uint256 liquidityAmount
    );
    event DividendClaimed(address indexed holder, address indexed recipient, uint256 amount);
    event CreatorFeesClaimed(address indexed recipient, uint256 amount);
    event BuybackReleased(address indexed vault, uint256 amount);
    event CreatorRecipientProposed(address indexed recipient, uint256 validAfter);
    event CreatorRecipientUpdated(address indexed recipient);
    event CreatorRecipientProposalCancelled(address indexed recipient);

    error Unauthorized();
    error ZeroAddress();
    error InvalidSplit();
    error TransferFailed();
    error Reentrancy();
    error TimelockActive();
    error NoPendingRecipient();

    uint256 private _locked;

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(Config memory cfg, Split memory split) {
        if (
            cfg.token == address(0) || cfg.hook == address(0) || cfg.factory == address(0)
                || cfg.poolManager == address(0) || cfg.treasury == address(0) || cfg.buybackVault == address(0)
                || cfg.liquidityVault == address(0) || cfg.creator == address(0)
        ) revert ZeroAddress();
        if (
            split.protocolBps > BPS
                || uint256(split.holdersBps) + split.burnBps + split.creatorBps + split.liquidityBps != BPS
        ) revert InvalidSplit();

        token = cfg.token;
        quoteAsset = cfg.quoteAsset;
        hook = cfg.hook;
        factory = cfg.factory;
        poolManager = cfg.poolManager;
        excluded = cfg.excluded;
        treasury = cfg.treasury;
        buybackVault = cfg.buybackVault;
        liquidityVault = cfg.liquidityVault;
        creator = cfg.creator;
        creatorRecipient = cfg.creator;
        protocolBps = split.protocolBps;
        holdersBps = split.holdersBps;
        burnBps = split.burnBps;
        creatorBps = split.creatorBps;
        liquidityBps = split.liquidityBps;
    }

    /// @notice Accepts native fees (PoolManager.take / launcher) when the quote is native.
    receive() external payable {}

    /**
     * @notice Splits `amount` of quote currency that the hook or factory already sent here.
     */
    function distributeFees(uint256 amount) external nonReentrant {
        if (msg.sender != hook && msg.sender != factory) revert Unauthorized();
        if (amount == 0) return;

        uint256 protocolShare = (amount * protocolBps) / BPS;
        uint256 rest = amount - protocolShare;
        uint256 burnShare = (rest * burnBps) / BPS;
        uint256 creatorShare = (rest * creatorBps) / BPS;
        uint256 liquidityShare = (rest * liquidityBps) / BPS;
        uint256 holdersShare = rest - burnShare - creatorShare - liquidityShare;

        if (holdersShare > 0 && holdersBps == 0) {
            // Rounding dust when holders are not part of the split.
            protocolShare += holdersShare;
            holdersShare = 0;
        }
        if (holdersShare > 0) _notifyHolders(holdersShare);
        creatorAccrued += creatorShare;
        buybackAccrued += burnShare;

        _send(treasury, protocolShare);
        _send(liquidityVault, liquidityShare);

        emit FeesReceived(amount, protocolShare, holdersShare, burnShare, creatorShare, liquidityShare);
    }

    // ---------------------------------------------------------------------------
    // Holder dividends
    // ---------------------------------------------------------------------------

    /// @notice Supply eligible for dividends: excludes pool liquidity, burned and excluded balances.
    function circulatingSupply() public view returns (uint256) {
        uint256 supply = IERC20Minimal(token).totalSupply();
        uint256 nonCirculating = IERC20Minimal(token).balanceOf(poolManager) + IERC20Minimal(token).balanceOf(DEAD);
        if (excluded != address(0)) nonCirculating += IERC20Minimal(token).balanceOf(excluded);
        return supply > nonCirculating ? supply - nonCirculating : 0;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        uint256 t = lastTimeRewardApplicable();
        uint256 circulating = circulatingSupply();
        if (t <= lastUpdateTime || circulating == 0) return rewardPerTokenStored;
        return rewardPerTokenStored + (rewardRate * (t - lastUpdateTime)) / circulating;
    }

    function claimable(address holder) public view returns (uint256) {
        if (_isExcluded(holder)) return 0;
        uint256 balance = IERC20Minimal(token).balanceOf(holder);
        return userEarned[holder] + (balance * (rewardPerToken() - userRewardPerTokenPaid[holder])) / PRECISION;
    }

    /**
     * @notice Checkpoints both sides of a transfer. Called by LaunchpadToken before balances change.
     */
    function setShare(address from, address to, uint256 /* amount */ ) external {
        if (msg.sender != token) revert Unauthorized();
        _updateStream();
        _checkpoint(from);
        _checkpoint(to);
    }

    function claim(address recipient) external nonReentrant returns (uint256 reward) {
        _updateStream();
        _checkpoint(msg.sender);
        reward = userEarned[msg.sender];
        if (reward > 0) {
            userEarned[msg.sender] = 0;
            address payoutTo = recipient != address(0) ? recipient : msg.sender;
            _send(payoutTo, reward);
            emit DividendClaimed(msg.sender, payoutTo, reward);
        }
    }

    /// @notice Hands the accrued burn share to the buyback contract, which swaps it for this token
    ///         under a TWAP price guard and burns the tokens.
    function releaseBuyback() external nonReentrant returns (uint256 amount) {
        if (msg.sender != buybackVault) revert Unauthorized();
        amount = buybackAccrued;
        if (amount > 0) {
            buybackAccrued = 0;
            _send(buybackVault, amount);
            emit BuybackReleased(buybackVault, amount);
        }
    }

    function claimCreatorFees() external nonReentrant returns (uint256 amount) {
        if (msg.sender != creator && msg.sender != creatorRecipient) revert Unauthorized();
        amount = creatorAccrued;
        if (amount > 0) {
            creatorAccrued = 0;
            _send(creatorRecipient, amount);
            emit CreatorFeesClaimed(creatorRecipient, amount);
        }
    }

    // ---------------------------------------------------------------------------
    // Creator payout redirect (48h timelock)
    // ---------------------------------------------------------------------------

    function proposeCreatorRecipient(address recipient) external {
        if (msg.sender != creator) revert Unauthorized();
        if (recipient == address(0)) revert ZeroAddress();
        pendingCreatorRecipient = recipient;
        pendingCreatorRecipientValidAfter = block.timestamp + RECIPIENT_TIMELOCK;
        emit CreatorRecipientProposed(recipient, pendingCreatorRecipientValidAfter);
    }

    function acceptCreatorRecipient() external {
        address pending = pendingCreatorRecipient;
        if (pending == address(0)) revert NoPendingRecipient();
        if (msg.sender != creator && msg.sender != pending) revert Unauthorized();
        if (block.timestamp < pendingCreatorRecipientValidAfter) revert TimelockActive();
        creatorRecipient = pending;
        pendingCreatorRecipient = address(0);
        pendingCreatorRecipientValidAfter = 0;
        emit CreatorRecipientUpdated(pending);
    }

    /// @notice Cancels a pending proposal only; an active redirect changes through the timelock.
    function cancelCreatorRecipient() external {
        if (msg.sender != creator) revert Unauthorized();
        address pending = pendingCreatorRecipient;
        if (pending == address(0)) revert NoPendingRecipient();
        pendingCreatorRecipient = address(0);
        pendingCreatorRecipientValidAfter = 0;
        emit CreatorRecipientProposalCancelled(pending);
    }

    // ---------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------

    function _notifyHolders(uint256 amount) private {
        _updateStream();
        uint256 leftover = block.timestamp < periodFinish ? (periodFinish - block.timestamp) * rewardRate : 0;
        rewardRate = (amount * PRECISION + leftover) / STREAM_DURATION;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + STREAM_DURATION;
        totalStreamed += amount;
    }

    function _updateStream() private {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
    }

    function _checkpoint(address account) private {
        if (account == address(0) || _isExcluded(account)) return;
        userEarned[account] = claimable(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }

    function _isExcluded(address account) private view returns (bool) {
        return account == poolManager || account == DEAD || (excluded != address(0) && account == excluded);
    }

    function _send(address to, uint256 amount) private {
        if (amount == 0) return;
        if (quoteAsset == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else if (!IERC20Minimal(quoteAsset).transfer(to, amount)) {
            revert TransferFailed();
        }
    }
}

/**
 * @title ProtoFeeSplitterDeployer
 * @notice Deploys ProtoFeeSplitter instances so launchers stay under the EIP-170 bytecode limit.
 *         Permissionless: a splitter only matters if a hook / launcher routes fees to it.
 */
contract ProtoFeeSplitterDeployer {
    function deploy(ProtoFeeSplitter.Config calldata cfg, ProtoFeeSplitter.Split calldata split)
        external
        returns (address)
    {
        return address(new ProtoFeeSplitter(cfg, split));
    }
}
