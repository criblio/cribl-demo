exports.name = 'Chain';
exports.version = '1.0';
exports.cribl_version = '3.2.0';
exports.disabled = false;
exports.handleSignals = true;
exports.group = 'Advanced'

let processorId;
let signature;
exports.init = opts => {
  processorId = opts.conf?.processor;
  signature = `${opts.cid}:${opts.pid}${opts.pipeIdx != null ? ':' + opts.pipeIdx : ''}`;
}

let processor;
exports.process = async event => {
  if (processor == null || processor.isClosed()) {
    processor = await C.internal.getEventProcessor(processorId).catch(() => undefined);
  }
  if (processor == null || event.__signatures?.has(signature)) return event;
  event.__signatures = event.__signatures ?? new Set();
  event.__signatures.add(signature);
  return processor == null ? event : await processor.process(event);
}

exports.unload = () => {
  processor?.close();
}