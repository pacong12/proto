// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IUniswapV3Factory,
    IUniswapV3Pool,
    INonfungiblePositionManager,
    ISwapRouter,
    IWETH
} from "../src/interfaces/IUniswapV3.sol";
import {ILaunchpadToken} from "../src/interfaces/ILaunchpadToken.sol";

contract MockWETH is IWETH {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable override {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external override {
        require(balanceOf[msg.sender] >= amount, "Insufficient");
        balanceOf[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        return true;
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= value, "Allowance");
            allowance[from][msg.sender] -= value;
        }
        require(balanceOf[from] >= value, "Balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        return true;
    }
}

contract MockUniswapV3Pool is IUniswapV3Pool {
    address public override token0;
    address public override token1;
    uint24 public override fee;
    uint160 public sqrtPriceX96;

    constructor(address _token0, address _token1, uint24 _fee) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
    }

    function initialize(uint160 _sqrtPriceX96) external override {
        sqrtPriceX96 = _sqrtPriceX96;
    }

    function slot0() external view override returns (
        uint160,
        int24,
        uint16,
        uint16,
        uint16,
        uint8,
        bool
    ) {
        return (sqrtPriceX96, 0, 0, 1, 1, 0, true);
    }
}

contract MockUniswapV3Factory is IUniswapV3Factory {
    mapping(bytes32 => address) public pools;

    function createPool(address tokenA, address tokenB, uint24 fee) external override returns (address pool) {
        bytes32 key = keccak256(abi.encodePacked(tokenA < tokenB ? tokenA : tokenB, tokenA < tokenB ? tokenB : tokenA, fee));
        if (pools[key] == address(0)) {
            address t0 = tokenA < tokenB ? tokenA : tokenB;
            address t1 = tokenA < tokenB ? tokenB : tokenA;
            MockUniswapV3Pool newPool = new MockUniswapV3Pool(t0, t1, fee);
            pool = address(newPool);
            pools[key] = pool;
        } else {
            pool = pools[key];
        }
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view override returns (address pool) {
        bytes32 key = keccak256(abi.encodePacked(tokenA < tokenB ? tokenA : tokenB, tokenA < tokenB ? tokenB : tokenA, fee));
        return pools[key];
    }
}

contract MockPositionManager is INonfungiblePositionManager {
    uint256 public nextId = 1;

    struct PosData {
        address token0;
        address token1;
        uint24 fee;
        uint128 liquidity;
    }
    mapping(uint256 => PosData) public overridePositions;
    mapping(uint256 => address) public owners;

    function mint(MintParams calldata params) external payable override returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    ) {
        tokenId = nextId++;
        liquidity = 1000000;
        overridePositions[tokenId] = PosData(params.token0, params.token1, params.fee, liquidity);
        owners[tokenId] = params.recipient;
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;

        if (params.token0 != address(0) && amount0 > 0) {
            ILaunchpadToken(params.token0).transferFrom(msg.sender, address(this), amount0);
        }
        if (params.token1 != address(0) && amount1 > 0) {
            ILaunchpadToken(params.token1).transferFrom(msg.sender, address(this), amount1);
        }
    }

    function collect(CollectParams calldata params) external payable override returns (
        uint256 amount0,
        uint256 amount1
    ) {
        PosData memory p = overridePositions[params.tokenId];
        uint256 tokenFee = 1000 * 1e18;
        uint256 wethFee = 1 ether;

        if (ILaunchpadToken(p.token0).balanceOf(address(this)) >= tokenFee) {
            amount0 = tokenFee;
            amount1 = wethFee;
        } else {
            amount0 = wethFee;
            amount1 = tokenFee;
        }

        if (p.token0 != address(0) && amount0 > 0) {
            ILaunchpadToken(p.token0).transfer(params.recipient, amount0);
        }
        if (p.token1 != address(0) && amount1 > 0) {
            ILaunchpadToken(p.token1).transfer(params.recipient, amount1);
        }
    }

    function positions(uint256 tokenId) external view override returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    ) {
        PosData memory p = overridePositions[tokenId];
        return (0, address(0), p.token0, p.token1, p.fee, -887200, 887200, p.liquidity, 0, 0, 0, 0);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external override {
        owners[tokenId] = to;
    }
}

contract MockSwapRouter is ISwapRouter {
    function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256 amountOut) {
        amountOut = 1000 * 10**18;
        // Transfer tokens to recipient if router has sufficient balance
        if (params.recipient != address(0) && ILaunchpadToken(params.tokenOut).balanceOf(address(this)) >= amountOut) {
            ILaunchpadToken(params.tokenOut).transfer(params.recipient, amountOut);
        }
    }
}
