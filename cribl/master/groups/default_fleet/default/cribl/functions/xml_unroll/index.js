exports.name = 'XML Unroll';
exports.version = '0.2';
exports.group = 'Advanced';

const { NestedPropertyAccessor } = C.expr;
const { XMLParser, XMLBuilder, NamedGroupRegExp, getLogger } = C.util;
const cLogger = getLogger('func:xml_unroll');

let unrollIdxField;
let pretty = false;
let copyElementRegex;
let unrollElementRegex;

function shouldCopyElement(pathToElement) {
  return copyElementRegex && copyElementRegex.test(pathToElement);
}
function shouldUnrollElement(pathToElement) {
  return unrollElementRegex && unrollElementRegex.test(pathToElement);
}

exports.init = (opts) => {
  const conf = opts.conf || {};
  unrollElementRegex = new NamedGroupRegExp(conf.unroll.trim());
  unrollIdxField = new NestedPropertyAccessor(conf.unrollIdxField || 'unroll_idx');
  pretty = !!conf.pretty;
  copyElementRegex = undefined;
  if (conf.inherit) {
    try {
      copyElementRegex = new NamedGroupRegExp(conf.inherit.trim());
    } catch (error) {
      cLogger.warn('failed to parse inherit regex, ignoring', { inherit: conf.inherit, error });
    }
  }
};

exports.process = (event) => {
  try {
    const raw = event._raw;

    const parser = new XMLParser();
    const currPath = []; // path to current element (parent doc)
    let currClone = null; // contents of the current/being-built clone
    const clones = []; // once done, currClone get appended here
    const copyElements = []; // elements to copy from a parent of clone field down to each clone

    parser.on('openTag', (elementName, attrGetter) => {
      currPath.push(elementName);
      // see if this is an element we've been asked to copy from the parent
      if (!currClone && shouldCopyElement(currPath.join('.'))) {
        currClone = XMLBuilder.create(elementName);
        currClone._depth = currPath.length;
        const attr = attrGetter();
        Object.keys(attr).forEach(k => {
          currClone.att(k, attr[k]);
        });
        currClone._copyElement = true;
        return;
      }

      if (!currClone && shouldUnrollElement(currPath.join('.'))) {
        currClone = XMLBuilder.create(elementName);
        currClone._depth = currPath.length;
        const attr = attrGetter();
        Object.keys(attr).forEach(k => {
          currClone.att(k, attr[k]);
        });
      } else if (currClone) {
        currClone = currClone.ele(elementName, attrGetter());
      }
    });

    parser.on('text', (value) => {
      // ignore text nodes between other nodes (they're most likely white space)
      if (currClone && currClone.children.length === 0) {
        value = value.trim();
        if (value.length > 0) {
          currClone.raw(value);
        }
      }
    });

    parser.on('cdata', (value) => {
      if (currClone) currClone.dat(value);
    });

    parser.on('closeTag', (elementName) => {
      if (currPath[currPath.length - 1] === elementName) {
        currPath.pop();
      }
      if (currClone) {
        // can't go higher than root
        if (currClone !== currClone.root()) {
          currClone = currClone.up();
        }
        // see if we're done with this clone
        if (currPath.length < currClone._depth) {
          currClone = currClone.root(); // make sure we're at root
          (currClone._copyElement ? copyElements : clones).push(currClone);
          currClone = null;
        }
      }
    });

    parser.parse(raw);
    // no clones == return original (wrong event type maybe)
    if (clones.length === 0) {
      return event;
    }
    // now, convert clones to actual events, inherit all properties (except _raw from parent)
    return clones.map((c, idx) => {
      const ce = event.__clone();
      const cr = c.root();
      // copy any matching elements from the parent node
      for (let i = copyElements.length - 1; i > -1; i--) {
        cr.children.unshift(copyElements[i]);
      }
      ce._raw = cr.end({ pretty });
      unrollIdxField.set(ce, idx);
      return ce;
    });
  } catch (ignore) { }
  return event;
};
