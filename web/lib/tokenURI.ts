// Client-side decoder for the contract-produced tokenURI.
//
// Shape: `data:application/json;base64,<payload>`
// Payload is a JSON object with at least:
//   { name, description, image: "data:image/svg+xml;base64,<svg>", attributes: [{ trait_type, value }] }
//
// Everything decoded here is on-chain — no CDN, no remote fetches.

export type TokenAttribute = {
  trait_type: string;
  value: string | number;
};

export type TokenMetadata = {
  name: string;
  description?: string;
  image: string;
  attributes: TokenAttribute[];
  /** Raw decoded SVG markup (extracted from `image` when it is a data URI). */
  svg: string | null;
  /** Source URI that produced this metadata, for debugging. */
  source: string;
};

const DATA_JSON_BASE64_PREFIX = "data:application/json;base64,";
const DATA_JSON_UTF8_PREFIX = "data:application/json;utf8,";
const DATA_JSON_PLAIN_PREFIX = "data:application/json,";
const DATA_SVG_BASE64_PREFIX = "data:image/svg+xml;base64,";
const DATA_SVG_UTF8_PREFIX = "data:image/svg+xml;utf8,";
const DATA_SVG_PLAIN_PREFIX = "data:image/svg+xml,";

function fromBase64(b64: string): string {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(b64);
    let out = "";
    for (let i = 0; i < binary.length; i += 1) {
      out += "%" + binary.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return decodeURIComponent(out);
  }
  // Node / SSR fallback.
  return Buffer.from(b64, "base64").toString("utf8");
}

function decodeImage(image: string): string | null {
  if (image.startsWith(DATA_SVG_BASE64_PREFIX)) {
    return fromBase64(image.slice(DATA_SVG_BASE64_PREFIX.length));
  }
  if (image.startsWith(DATA_SVG_UTF8_PREFIX)) {
    return decodeURIComponent(image.slice(DATA_SVG_UTF8_PREFIX.length));
  }
  if (image.startsWith(DATA_SVG_PLAIN_PREFIX)) {
    return decodeURIComponent(image.slice(DATA_SVG_PLAIN_PREFIX.length));
  }
  return null;
}

export function parseTokenURI(uri: string): TokenMetadata {
  let json: string;
  if (uri.startsWith(DATA_JSON_BASE64_PREFIX)) {
    json = fromBase64(uri.slice(DATA_JSON_BASE64_PREFIX.length));
  } else if (uri.startsWith(DATA_JSON_UTF8_PREFIX)) {
    json = decodeURIComponent(uri.slice(DATA_JSON_UTF8_PREFIX.length));
  } else if (uri.startsWith(DATA_JSON_PLAIN_PREFIX)) {
    json = decodeURIComponent(uri.slice(DATA_JSON_PLAIN_PREFIX.length));
  } else {
    throw new Error(`Unsupported tokenURI scheme: ${uri.slice(0, 40)}...`);
  }

  const parsed = JSON.parse(json) as Partial<TokenMetadata> & {
    image?: string;
    attributes?: TokenAttribute[];
  };

  const image = parsed.image ?? "";
  return {
    name: parsed.name ?? "Ink Survivor",
    description: parsed.description,
    image,
    attributes: parsed.attributes ?? [],
    svg: image ? decodeImage(image) : null,
    source: uri,
  };
}

export type TokenState = "alive" | "grave" | "zombie" | "divine_shield";

export function readTokenState(metadata: TokenMetadata): TokenState {
  const stateAttr = metadata.attributes.find(
    (attr) => attr.trait_type.toLowerCase() === "state",
  );
  const value = String(stateAttr?.value ?? "alive").toLowerCase();
  if (value.includes("divine")) return "divine_shield";
  if (value.includes("zombie")) return "zombie";
  if (value.includes("grave")) return "grave";
  return "alive";
}

export function readTraits(metadata: TokenMetadata): TokenAttribute[] {
  return metadata.attributes.filter((attr) => {
    const t = attr.trait_type.toLowerCase();
    return t === "head" || t === "hand" || t === "skin";
  });
}
