// jsdom does not expose TextEncoder/TextDecoder, which @stellar/stellar-sdk
// reaches for at module load. Node has had both since v11.
const { TextEncoder, TextDecoder } = require('node:util')

if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder
if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder
