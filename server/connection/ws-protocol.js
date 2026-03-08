const crypto = require("crypto");
const { WS_GUID } = require("../config");

function wsAcceptKey(secKey) {
  return crypto.createHash("sha1").update(secKey + WS_GUID).digest("base64");
}

function encodeWsText(text) {
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;
  if (len < 126) return Buffer.concat([Buffer.from([0x81, len]), payload]);

  if (len < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(len), 2);
  return Buffer.concat([header, payload]);
}

function decodeClientFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    const opcode = byte1 & 0x0f;
    const masked = (byte2 & 0x80) !== 0;
    let payloadLen = byte2 & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      const bigLen = buffer.readBigUInt64BE(offset + 2);
      if (bigLen > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Frame too large");
      payloadLen = Number(bigLen);
      headerLen = 10;
    }

    const maskOffset = masked ? headerLen : null;
    const payloadOffset = headerLen + (masked ? 4 : 0);
    const frameTotal = payloadOffset + payloadLen;
    if (offset + frameTotal > buffer.length) break;
    if (!masked) throw new Error("Client frame must be masked");

    const mask = buffer.subarray(offset + maskOffset, offset + maskOffset + 4);
    const payload = Buffer.from(buffer.subarray(offset + payloadOffset, offset + payloadOffset + payloadLen));
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];

    if (opcode === 0x8) messages.push({ type: "close" });
    if (opcode === 0x1) messages.push({ type: "text", text: payload.toString("utf8") });

    offset += frameTotal;
  }

  return { messages, remaining: buffer.subarray(offset) };
}

module.exports = {
  wsAcceptKey,
  encodeWsText,
  decodeClientFrames,
};
