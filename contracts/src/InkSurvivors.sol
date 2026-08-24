// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721A} from "erc721a/ERC721A.sol";
import {InkMath} from "./InkMath.sol";
import {Renderer} from "./Renderer.sol";

/// @title InkSurvivors
/// @notice ERC721A NFT with on-chain pixel art and ink-based mutation gambling.
contract InkSurvivors is ERC721A {
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MAX_PER_TX = 5;
    uint256 public constant MAX_PER_WALLET = 5;
    uint256 public constant INK_SIZE = 1_000;

    /// @notice Mint price per token set to 0.00005 ETH for mainnet.
    uint256 public mintPrice = 0.00005 ether;

    /// @notice EIP-2981 royalty fee — 3% of secondary-sale price.
    uint96 public constant ROYALTY_FEE_BPS = 300;
    uint96 internal constant BPS_DENOM = 10_000;

    /// @notice Mint fees always withdraw to this hard-coded wallet.
    address public constant FEES_WALLET = 0xC68af4EeAc9277F776D1071f42300F0DF3961eae;

    address public immutable owner;
    uint256[] public inkSeeds;
    mapping(address => uint256) public mintedPerWallet;

    event InkClosed(uint256 indexed inkIndex, uint256 seed, uint256 mintedAt);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);

    error QuantityInvalid();
    error QuantityExceedsTxLimit();
    error WalletMintLimit();
    error WrongMintPrice();
    error SupplyExhausted();
    error WithdrawFailed();
    error NotOwner();

    constructor() ERC721A("Ink Survivors", "INK") {
        owner = msg.sender;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    /// @notice Update the mint price live. Only callable by the deployer.
    function setMintPrice(uint256 newPrice) external {
        if (msg.sender != owner) revert NotOwner();
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
    }

    function mint(uint256 quantity) external payable {
        if (quantity == 0) revert QuantityInvalid();
        if (quantity > MAX_PER_TX) revert QuantityExceedsTxLimit();
        if (msg.value != mintPrice * quantity) revert WrongMintPrice();

        uint256 newWalletCount = mintedPerWallet[msg.sender] + quantity;
        if (newWalletCount > MAX_PER_WALLET) revert WalletMintLimit();

        uint256 oldTotal = _totalMinted();
        uint256 newTotal = oldTotal + quantity;
        if (newTotal > MAX_SUPPLY) revert SupplyExhausted();

        mintedPerWallet[msg.sender] = newWalletCount;
        _mint(msg.sender, quantity);

        uint256 firstBoundary = ((oldTotal / INK_SIZE) + 1) * INK_SIZE;
        for (uint256 boundary = firstBoundary; boundary <= newTotal; boundary += INK_SIZE) {
            uint256 seed = uint256(keccak256(abi.encode(block.prevrandao, boundary, blockhash(block.number - 1))));
            uint256 idx = inkSeeds.length;
            inkSeeds.push(seed);
            emit InkClosed(idx, seed, boundary);
        }
    }

    function inkSeedsLength() external view returns (uint256) {
        return inkSeeds.length;
    }

    function stateOf(uint256 tokenId) external view returns (InkMath.TokenState memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        return InkMath.compute(tokenId, inkSeeds);
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        InkMath.TokenState memory state = InkMath.compute(tokenId, inkSeeds);
        return Renderer.tokenURI(tokenId, state);
    }

    function royaltyInfo(uint256, uint256 salePrice)
        external
        pure
        returns (address receiver, uint256 royaltyAmount)
    {
        return (FEES_WALLET, (salePrice * ROYALTY_FEE_BPS) / BPS_DENOM);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == 0x2a55205a || super.supportsInterface(interfaceId);
    }

    function withdraw() external {
        (bool ok,) = payable(FEES_WALLET).call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }
}