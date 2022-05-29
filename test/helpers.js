const { expect } = require("chai");
const { ethers } = require("ethers");

function timeToBigNumber(dateTime) {
  const seconds = Math.ceil(dateTime.toSeconds()).toString();
  return ethers.utils.parseUnits(seconds, "wei");
}

async function expectEvent(tx, eventName, eventArgs = {}) {
  const receipt = await tx.wait();
  const event = receipt.events.find(evt => evt.event === eventName);
  const entries = Object.entries(eventArgs);
  for (let i = 0; i < event.args.length; i++) {
    const [key, value] = entries[i];
    expect(event.args[i]).to.equal(value);
  }
}

async function expectEventInConstruction(contract, eventName, eventArgs = {}) {
  if (!isContract(contract)) {
    throw new Error("expectEvent.inConstruction is only supported for truffle-contract objects");
  }
  return expectEventInTransaction(contract.transactionHash, contract.constructor, eventName, eventArgs);
}

async function expectEventInTransaction(txHash, emitter, eventName, eventArgs = {}) {
  const receipt = await ethers.provider.getTransactionReceipt(txHash);

  const logs = decodeLogs(receipt.logs, emitter, eventName);
  return inLogs(logs, eventName, eventArgs);
}

// This decodes longs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts
function decodeLogs(logs, emitter, eventName) {
  let abi;
  let address;
  if (isWeb3Contract(emitter)) {
    abi = emitter.options.jsonInterface;
    address = emitter.options.address;
  } else if (isTruffleContract(emitter)) {
    abi = emitter.abi;
    try {
      address = emitter.address;
    } catch (e) {
      address = null;
    }
  } else {
    throw new Error("Unknown contract object");
  }

  let eventABI = abi.filter(x => x.type === "event" && x.name === eventName);
  if (eventABI.length === 0) {
    throw new Error(`No ABI entry for event "${eventName}"`);
  } else if (eventABI.length > 1) {
    throw new Error(`Multiple ABI entries for event "${eventName}", only uniquely named events are supported`);
  }

  eventABI = eventABI[0];

  // The first topic will equal the hash of the event signature
  const eventSignature = `${eventName}(${eventABI.inputs.map(input => input.type).join(",")})`;
  const eventTopic = web3.utils.sha3(eventSignature);

  // Only decode events of type "EventName"
  return logs
    .filter(log => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address))
    .map(log => web3.eth.abi.decodeLog(eventABI.inputs, log.data, log.topics.slice(1)))
    .map(decoded => ({ event: eventName, args: decoded }));
}

function inLogs(logs, eventName, eventArgs = {}) {
  const events = logs.filter(e => e.event === eventName);
  expect(events.length > 0).to.equal(true, `No "${eventName}" events found`);

  const exception = [];
  const event = events.find(function (e) {
    for (const [k, v] of Object.entries(eventArgs)) {
      try {
        contains(e.args, k, v);
      } catch (error) {
        exception.push(error);
        return false;
      }
    }
    return true;
  });

  if (event === undefined) {
    throw exception[0];
  }

  return event;
}

async function expectException(promise, expectedError) {
  try {
    await promise;
  } catch (e) {
    if (e.message.indexOf(expectedError) === -1) {
      // When the exception was a revert, the resulting string will include only
      // the revert reason, otherwise it will be the type of exception (e.g. "invalid opcode")
      const actualError = error.message.replace(
        /Returned error: VM Exception while processing transaction: (revert )?/,
        "",
      );
      expect(actualError).to.equal(expectedError, "Wrong kind of exception received");
    }
    return;
  }
  expect.fail("Expected an exception but none was received");
}

function isContract(contract) {
  return "abi" in contract && typeof contract.abi === "object";
}

module.exports = {
  timeToBigNumber,
  expectEvent,
  expectEventInConstruction,
  expectEventInTransaction,
  expectException
};
