// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20TS {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/**
 * @title GotonTeamSplitter
 * @notice Splits whatever it receives between a fixed team: native currency (ETH on Robinhood
 *         Chain, USDC on Arc) and any ERC-20 (a token's own tax, USDC). A creator points a
 *         token's tax recipient or fee-splitter payout here instead of at one wallet.
 *
 *         Payees and shares are fixed at construction; there is no owner and nothing can be
 *         changed. Payouts are pulled: anyone may call `release(asset, payee)`, and it always pays
 *         the payee, never the caller. Each payee is owed its share of everything this contract
 *         has ever received in that asset, minus what it was already paid, so payees can release
 *         at different times without affecting each other.
 */
contract GotonTeamSplitter {
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_PAYEES = 10;
    /// @notice `asset` value for the chain's native currency.
    address public constant NATIVE = address(0);

    address[] private _payees;
    mapping(address => uint256) public shareBps;

    mapping(address => uint256) public totalReleased;
    mapping(address => mapping(address => uint256)) public released;

    uint256 private _locked;

    event PaymentReleased(address indexed asset, address indexed payee, uint256 amount);

    error InvalidTeam();
    error NotPayee();
    error NothingDue();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(address[] memory payees_, uint16[] memory sharesBps_) {
        uint256 n = payees_.length;
        if (n == 0 || n > MAX_PAYEES || n != sharesBps_.length) revert InvalidTeam();
        uint256 total = 0;
        for (uint256 i; i < n; i++) {
            address payee = payees_[i];
            uint256 share = sharesBps_[i];
            if (payee == address(0) || share == 0 || shareBps[payee] != 0) revert InvalidTeam();
            shareBps[payee] = share;
            _payees.push(payee);
            total += share;
        }
        if (total != BPS) revert InvalidTeam();
    }

    receive() external payable {}

    function payees() external view returns (address[] memory) {
        return _payees;
    }

    /// @notice What `payee` can release of `asset` now.
    function releasable(address asset, address payee) public view returns (uint256) {
        uint256 share = shareBps[payee];
        if (share == 0) return 0;
        uint256 received = _balance(asset) + totalReleased[asset];
        return (received * share) / BPS - released[asset][payee];
    }

    /// @notice Pays `payee` its due share of `asset` (address(0) for native). Callable by anyone.
    // slither-disable-next-line incorrect-equality (nothing due is exactly zero; see docs/audit/AUDIT-VERIFICATION.md)
    function release(address asset, address payee) public nonReentrant returns (uint256 amount) {
        if (shareBps[payee] == 0) revert NotPayee();
        amount = releasable(asset, payee);
        if (amount == 0) revert NothingDue();
        released[asset][payee] += amount;
        totalReleased[asset] += amount;
        emit PaymentReleased(asset, payee, amount);
        _send(asset, payee, amount);
    }

    /// @notice Pays every payee its due share of `asset`; payees with nothing due are skipped.
    function releaseAll(address asset) external {
        uint256 n = _payees.length;
        for (uint256 i; i < n; i++) {
            if (releasable(asset, _payees[i]) > 0) release(asset, _payees[i]);
        }
    }

    function _balance(address asset) private view returns (uint256) {
        return asset == NATIVE ? address(this).balance : IERC20TS(asset).balanceOf(address(this));
    }

    // slither-disable-next-line arbitrary-send-eth (`to` is always a payee fixed at construction; see docs/audit/AUDIT-VERIFICATION.md)
    function _send(address asset, address to, uint256 amount) private {
        if (asset == NATIVE) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
            return;
        }
        // Accept ERC-20s that return nothing as well as those that return true.
        (bool success, bytes memory data) = asset.call(abi.encodeCall(IERC20TS.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}

/**
 * @title GotonTeamSplitterFactory
 * @notice Deploys team splitters at addresses that can be computed before deployment (CREATE2),
 *         so the app can name a team as a token's tax recipient in the launch flow. Permissionless.
 */
contract GotonTeamSplitterFactory {
    event TeamCreated(address indexed splitter, address indexed creator, address[] payees, uint16[] sharesBps);

    function create(address[] calldata payees, uint16[] calldata sharesBps, bytes32 salt)
        external
        returns (GotonTeamSplitter splitter)
    {
        splitter = new GotonTeamSplitter{salt: _salt(payees, sharesBps, salt)}(payees, sharesBps);
        emit TeamCreated(address(splitter), msg.sender, payees, sharesBps);
    }

    /// @notice Address `create` deploys to for these arguments.
    function predict(address[] calldata payees, uint16[] calldata sharesBps, bytes32 salt)
        external
        view
        returns (address)
    {
        bytes32 codeHash =
            keccak256(abi.encodePacked(type(GotonTeamSplitter).creationCode, abi.encode(payees, sharesBps)));
        return address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(bytes1(0xff), address(this), _salt(payees, sharesBps, salt), codeHash))
                )
            )
        );
    }

    function _salt(address[] calldata payees, uint16[] calldata sharesBps, bytes32 salt)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(payees, sharesBps, salt));
    }
}
