// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EmergencyPause} from "../../core/EmergencyPause.sol";
import {LaunchpadToken} from "../../core/LaunchpadToken.sol";
import {ILaunchpadToken} from "../../interfaces/ILaunchpadToken.sol";
import {BondingCurve} from "../../core/BondingCurve.sol";
import {GotonV4Graduator} from "../../core/GotonV4Graduator.sol";

/**
 * @title LaunchpadV2Factory
 * @notice Factory for launching tokens on the V2 bonding curve architecture.
 *
 * Graduation is trustless: once a curve reaches its target anyone may call `graduate(token)`,
 * which moves the curve's ETH and tokens into a locked native-ETH Uniswap v4 pool through
 * GotonV4Graduator. There is no owner-chosen migration recipient.
 *
 * Security notes:
 *   - C-03 fix: constructor validates that feeRecipient and graduator are non-zero.
 *   - emergencyWithdrawFromCurve only applies to graduated curves left unmigrated past the deadline.
 *   - CEI pattern: state storage and event emission precede external fee transfer and curve buy.
 *   - nonReentrant guard on launchTokenV2.
 *   - CREATE2 deploy: token and curve bytecode contains no constructor args, enabling
 *     block-explorer auto-verification via bytecode match without per-token submissions.
 */
contract LaunchpadV2Factory is EmergencyPause {
    uint256 public launchFee = 0.0005 ether;
    /// @notice Hard cap on the owner-set launch fee, so creators can rely on it.
    uint256 public constant MAX_LAUNCH_FEE = 0.01 ether;
    uint256 public constant GRADUATION_TARGET = 4.2 ether;
    uint256 public constant VIRTUAL_ETH_RESERVE = 1.68 ether;
    uint256 public constant VIRTUAL_TOKEN_RESERVE = 1_000_000_000 * 1e18;

    address payable public immutable protocolFeeRecipient;
    GotonV4Graduator public immutable graduator;

    address public owner;
    address public pendingOwner;

    bool private _locked;

    /// @dev Nonce incremented per launch to ensure unique CREATE2 salts.
    uint256 private _nonce;

    struct V2Launch {
        address token;
        address curve;
        address creator;
        uint256 createdAt;
        bool graduated;
    }

    mapping(address => V2Launch) public launches;
    // F-11 fix: reverse lookup curve → token so migrateCurveToV4 can update graduated flag.
    mapping(address => address) public curveToToken;
    address[] public allLaunches;

    event TokenLaunchedV2(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialBuy
    );
    event TokenGraduated(address indexed token, bytes32 indexed poolId, address splitter);
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event OwnershipTransferProposed(address indexed proposed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error InvalidFee();
    error TransferFailed();
    error ZeroAddress();
    error Unauthorized();
    error NoPendingOwner();
    error NotFactory();
    error NotGraduated();
    error UnknownToken();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "REENTRANT");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address payable _feeRecipient, GotonV4Graduator _graduator) {
        // C-03 fix: validate all addresses that receive value or tokens.
        if (_feeRecipient == address(0) || address(_graduator) == address(0)) revert ZeroAddress();

        protocolFeeRecipient = _feeRecipient;
        graduator = _graduator;
        owner = msg.sender;
    }

    /// @dev Receives BondingCurve refunds when a creator's initial buy hits the curve cap (S4).
    receive() external payable {}

    function setLaunchFee(uint256 _newFee) external onlyOwner {
        if (_newFee > MAX_LAUNCH_FEE) revert InvalidFee();
        uint256 oldFee = launchFee;
        launchFee = _newFee;
        emit LaunchFeeUpdated(oldFee, _newFee);
    }

    function _pauseOwner() internal view override returns (address) {
        return owner;
    }

    function LAUNCH_FEE() external view returns (uint256) {
        return launchFee;
    }

    // ---------------------------------------------------------------------------
    // Owner administration
    // ---------------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferProposed(newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NoPendingOwner();
        address previous = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }

    // ---------------------------------------------------------------------------
    // CREATE2 helpers
    // ---------------------------------------------------------------------------

    /**
     * @notice Predict the CREATE2 address for a LaunchpadToken before deployment.
     * @param salt The salt used (keccak256 of deployer + nonce).
     */
    function predictTokenAddress(bytes32 salt) external view returns (address) {
        return _predict(type(LaunchpadToken).creationCode, salt);
    }

    /**
     * @notice Predict the CREATE2 address for a BondingCurve before deployment.
     * @param salt The salt used (keccak256 of deployer + nonce + 1).
     */
    function predictCurveAddress(bytes32 salt) external view returns (address) {
        return _predict(type(BondingCurve).creationCode, salt);
    }

    function _predict(bytes memory creationCode, bytes32 salt) internal view returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creationCode)));
        return address(uint160(uint256(hash)));
    }

    // ---------------------------------------------------------------------------
    // Core launch
    // ---------------------------------------------------------------------------

    function launchTokenV2(
        string memory name,
        string memory symbol,
        string memory logo,
        string memory description,
        string memory twitter,
        string memory telegram,
        string memory website,
        uint256 minInitialTokensOut
    ) external payable nonReentrant whenNotPaused returns (address tokenAddress, address curveAddress) {
        if (msg.value < launchFee) revert InvalidFee();

        uint256 initialBuyEth = msg.value - launchFee;

        ILaunchpadToken.Socials memory socials = ILaunchpadToken.Socials({
            twitter: twitter, telegram: telegram, discord: "", website: website, farcaster: ""
        });

        // Derive unique salts from deployer + nonce so two simultaneous launches
        // from the same address in the same block never collide.
        uint256 nonce = _nonce++;
        bytes32 tokenSalt = keccak256(abi.encode(msg.sender, nonce));
        bytes32 curveSalt = keccak256(abi.encode(msg.sender, nonce, uint256(1)));

        // CREATE2 deploy — no constructor args; bytecode is identical across all tokens.
        LaunchpadToken token = new LaunchpadToken{salt: tokenSalt}();
        BondingCurve curve = new BondingCurve{salt: curveSalt}();

        tokenAddress = address(token);
        curveAddress = address(curve);

        // Initialize token: supply minted to this factory (address(this)) so we can
        // transfer it to the curve in the next step without a separate approval.
        token.initialize(name, symbol, logo, description, socials, msg.sender, address(0), address(this));
        token.setRestrictionExempt(protocolFeeRecipient, true);

        // Initialize curve with all bonding curve parameters.
        curve.initialize(
            tokenAddress,
            address(this),
            protocolFeeRecipient,
            payable(msg.sender),
            GRADUATION_TARGET,
            VIRTUAL_ETH_RESERVE,
            VIRTUAL_TOKEN_RESERVE,
            address(graduator.poolManager()),
            address(graduator.hook())
        );

        bool tokenSent = token.transfer(curveAddress, token.totalSupply());
        if (!tokenSent) revert TransferFailed();

        // H-02 fix: register the bonding curve as the liquidity pool so that
        // anti-snipe restrictions in LaunchpadToken._transfer() are active.
        // NOTE: setLiquidityPool is called AFTER the initial buy so that the
        // factory's internal buyFor (snipe-fee distributions to protocolFeeRecipient)
        // are not blocked by the deployer-only guard that activates once liquidityPool
        // is set.

        launches[tokenAddress] = V2Launch({
            token: tokenAddress, curve: curveAddress, creator: msg.sender, createdAt: block.timestamp, graduated: false
        });
        curveToToken[curveAddress] = tokenAddress; // F-11: reverse mapping for flag update
        allLaunches.push(tokenAddress);

        emit TokenLaunchedV2(tokenAddress, curveAddress, msg.sender, name, symbol, initialBuyEth);

        (bool feeOk,) = protocolFeeRecipient.call{value: launchFee}("");
        if (!feeOk) revert TransferFailed();

        if (initialBuyEth > 0) {
            uint256 tokensBought = curve.buyFor{value: initialBuyEth}(msg.sender, minInitialTokensOut);
            require(tokensBought >= minInitialTokensOut, "Slippage");
            // S4: forward any cap-reached refund the curve sent back to this factory.
            uint256 refund = address(this).balance;
            if (refund > 0) {
                (bool refundOk,) = payable(msg.sender).call{value: refund}("");
                if (!refundOk) revert TransferFailed();
            }
        }

        token.setLiquidityPool(curveAddress);
    }

    // ---------------------------------------------------------------------------
    // Graduation
    // ---------------------------------------------------------------------------

    /**
     * @notice Moves a graduated curve's liquidity into its locked Uniswap v4 pool. Permissionless.
     * @dev Not pausable: a graduated curve no longer accepts sells, so graduating is its holders'
     *      only exit, and a pause must never trap them until emergencyWithdrawFromCurve opens.
     */
    // slither-disable-next-line reentrancy-no-eth (guarded by nonReentrant / onlyPoolManager / trusted caller; see docs/audit/AUDIT-VERIFICATION.md)
    function graduate(address tokenAddress) external nonReentrant returns (bytes32 poolId, address splitter) {
        V2Launch storage launch = launches[tokenAddress];
        if (launch.curve == address(0)) revert UnknownToken();
        BondingCurve curve = BondingCurve(payable(launch.curve));
        if (!curve.graduated()) revert NotGraduated();

        uint160 sqrtPriceX96 = curve.graduationSqrtPriceX96();
        // Otherwise the curve -> graduator transfer counts as a buy and pays the creator's buy tax.
        LaunchpadToken(tokenAddress).clearLiquidityPool();
        curve.migrateLiquidity(payable(address(graduator)));
        (poolId, splitter) = graduator.graduate(tokenAddress, launch.creator, launch.curve, sqrtPriceX96);

        // Holder dividends from LP fees are checkpointed on every transfer from now on.
        LaunchpadToken(tokenAddress).setRewardTracker(splitter);
        launch.graduated = true;
        emit TokenGraduated(tokenAddress, poolId, splitter);
    }

    /**
     * @notice Emergency withdrawal from a graduated bonding curve after the
     *         migration deadline has passed. Only callable by owner.
     * @dev F-11 fix: also marks graduated = true to reflect the curve has exited.
     */
    function emergencyWithdrawFromCurve(address curve, address payable recipient) external onlyOwner {
        address token = curveToToken[curve];
        if (token != address(0)) LaunchpadToken(token).clearLiquidityPool();
        BondingCurve(payable(curve)).emergencyWithdraw(recipient);
        if (token != address(0)) {
            launches[token].graduated = true;
        }
    }

    // ---------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------

    function getLaunchCount() external view returns (uint256) {
        return allLaunches.length;
    }
}
