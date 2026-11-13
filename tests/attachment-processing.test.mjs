import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:net";
import sharp from "sharp";
import {scanAttachment,parseScannerVersion} from "../src/server/attachments/clamav.ts";
import {prepareAttachment,attachmentHash,verifyAttachment} from "../src/server/attachments/content.ts";

const fresh=()=>`ClamAV 1.5.4/28182/${new Date().toUTCString().replace(/ GMT$/,"")}`;
async function transport(scanReply="stream: OK",version=fresh()){
 const captured=[];
 const server=createServer(socket=>{
  let bytes=Buffer.alloc(0),command=null,content=[];
  socket.on("data",part=>{
   bytes=Buffer.concat([bytes,part]);
   if(!command){const end=bytes.indexOf(0);if(end<0)return;command=bytes.subarray(0,end).toString();bytes=bytes.subarray(end+1);if(command==="zVERSION"){socket.write(`${version}\0`);return;}}
   if(command!=="zINSTREAM")return;
   while(bytes.length>=4){const size=bytes.readUInt32BE(0);if(bytes.length<4+size)return;const chunk=bytes.subarray(4,4+size);bytes=bytes.subarray(4+size);if(size===0){captured.push(Buffer.concat(content));socket.write(`${scanReply}\0`);return;}content.push(chunk);}
  });
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 return {captured,config:{host:"127.0.0.1",port:server.address().port,timeoutMs:1000},close:()=>new Promise(resolve=>server.close(resolve))};
}
test("protocol fixture verifies exact framed chunks/bytes; it is not an antivirus integration claim",async()=>{
 const fixture=await transport();try{const bytes=Buffer.alloc(150000,97);const proof=await scanAttachment(bytes,fixture.config);assert.equal(proof.scanner_version,"1.5.4");assert.deepEqual(fixture.captured[0],bytes);}finally{await fixture.close();}
});
test("FOUND, limit errors, malformed and non-exact clean replies all fail closed",async()=>{
 for(const reply of ["stream: Eicar-Test-Signature FOUND","INSTREAM size limit exceeded. ERROR","stream: OK\n","unexpected"]){const fixture=await transport(reply);try{await assert.rejects(scanAttachment(Buffer.from("synthetic"),fixture.config));}finally{await fixture.close();}}
});
test("signature age and security branch minima reject stale, vulnerable and prerelease engines",()=>{
 for(const version of ["1.3.9","1.4.5","1.5.0","1.5.3","1.5.4-dev","2.0.0"])
  assert.throws(()=>parseScannerVersion(fresh().replace("1.5.4",version)));
 assert.equal(parseScannerVersion(fresh().replace("1.5.4","1.4.6")).scanner_version,"1.4.6");
 assert.throws(()=>parseScannerVersion("ClamAV 1.5.4/1/Fri Nov 1 06:24:28 2020"));
});
test("actual image bytes normalize without metadata; PDF is attachment-only bytes; active formats/hash mismatch reject",async()=>{
 const original=await sharp({create:{width:30,height:20,channels:3,background:"red"}}).withExif({IFD0:{Artist:"Synthetic fixture"}}).jpeg().toBuffer();
 const prepared=await prepareAttachment(original);assert.equal(prepared.contentType,"image/webp");assert.equal((await sharp(prepared.bytes).metadata()).exif,undefined);
 const pdf=Buffer.from("%PDF-1.7\nSynthetic test fixture only\n%%EOF\n");assert.equal((await prepareAttachment(pdf)).contentType,"application/pdf");
 await assert.rejects(prepareAttachment(Buffer.from("<svg><script>alert(1)</script></svg>")));
 verifyAttachment(prepared.bytes,prepared.bytes.length,attachmentHash(prepared.bytes));
 assert.throws(()=>verifyAttachment(prepared.bytes,prepared.bytes.length,"0".repeat(64)));
});
test("actual configured ClamAV accepts synthetic PNG and detects harmless EICAR",{skip:process.env.CLAMAV_INTEGRATION!=="1"},async()=>{
 const png=await sharp({create:{width:12,height:12,channels:3,background:"blue"}}).png().toBuffer();
 const proof=await scanAttachment(png);assert.ok(proof.signature_version);
 // Construct the standard harmless test marker in memory, not a downloaded file.
 const marker=["X5O!P%@AP[4\\PZX54(P^)7CC)7}","$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join("");
 await assert.rejects(scanAttachment(Buffer.from(marker)),/rejected by the security scanner/);
});
