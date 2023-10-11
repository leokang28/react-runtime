/** @jsx R.createElement */
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      // 把文本、数字等简单类型统一包装一下
      children: children.map(child => {
        return typeof child === 'object'
          ? child
          : createTextElement(child)
      }),
    },
  };
}
function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  };
}
function createDom(fiber) {
  const dom = 
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode("")
      : document.createElement(fiber.type);
  updateDom(dom, {}, fiber.props);
  return dom;
}
// During render stage, the render function accept a
// vdom tree as its first param, which will be used to
// generate the fiber tree by vdom tree.
// In other words, render stage generates the fiber
// tree and the commit stage makes all of dom changes
// happen according to the fiber tree generated before.
function render(element, container) {
  wiproot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: croot,
  }
  deletions = [];
  nextUnitOfWork = wiproot;
  requestIdleCallback(workLoop);
}
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wiproot.child);
  croot = wiproot;
  wiproot = null;
  console.log(croot);
}

const isProperty = key => key !== 'children' && !isEvent(key);
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (next) => key => !(key in next);
const isEvent = key => key.startsWith('on');

function updateDom(dom, prevProps, nextProps) {
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => {
      return !(key in nextProps) || isNew(prevProps, nextProps)(key);
    })
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(nextProps))
    .forEach(name => {
      dom[name] = '';
    });
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name];
    });
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    })
}

function commitDeletion(fiber, dom) {
  if (fiber.dom) {
    dom.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, dom);
  }

}
function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  let domParentFiber = fiber.parent;
  while(!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'DELETION') {
    commitDeletion(fiber, domParent);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  }
  commitWork(fiber.child)
  commitWork(fiber.sibling);
}
let croot = null;
let wiproot = null;
let nextUnitOfWork = null;
let deletions = null;
function workLoop(deadline) {
  if (!wiproot) {
    console.log('the last working in progress fibertree is commit, stop workloop now');
    return;
  }
  console.log('i will never die until there is no working in progress fibertree');
  let shouldYield = false;
  while(nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  if (!nextUnitOfWork && wiproot) {
    commitRoot()
  }
  requestIdleCallback(workLoop);
}

let wipFiber = null;
let hookIndex = null;
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  reconcileChildren(fiber, fiber.props.children);
}

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  // if (fiber.parent) {
  //   fiber.parent.dom.appendChild(fiber.dom);
  // }

    // 如果有子元素，把它当作下一个人物
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  // 否则尝试返回下一个兄弟元素，如果没有就去找父级的兄弟节点
  while(nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let prevSibling = null;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;
    const isSame = element && oldFiber && element.type === oldFiber.type;
    if (isSame) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      };
    }
    if (element && !isSame) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT',
      };
    }
    if (oldFiber && !isSame) {
      oldFiber.effectTag = 'DELETION';
      deletions.push(oldFiber);
      
    }
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }
    if (index === 0) {
      wipFiber.child = newFiber;
    } else if(element) {
      prevSibling.sibling = newFiber;
    }
    index += 1;
    prevSibling = newFiber;
  }

}
function useState(initialState) {
  const oldHook = wipFiber.alternate
    && wipFiber.alternate.hooks
    && wipFiber.alternate.hooks[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : initialState,
    queue: [],
  }
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(action => hook.state = action(hook.state))
  const setState = action => {
    hook.queue.push(action);
    wiproot = {
      dom: croot.dom,
      props: croot.props,
      alternate: croot,
    }
    nextUnitOfWork = wiproot;
    deletions = [];
    requestIdleCallback(workLoop);

  }
  wipFiber.hooks.push(hook);
  hookIndex += 1;
  return [hook.state, setState];
}
const R = {
  createElement,
  render,
  useState,
};
// const updateValue = e => renderWrap(e.target.value)
// const container = document.getElementById('root');
// const renderWrap = value => {
//   const ele = (
//     <div id="foo" style="background-color: salmon">
//       <input onInput={updateValue} name='haha' />
//       <h1>My minimum React-like Runtime R</h1>
//       <h2 style="text-align: right">{value}</h2>
//     </div>
//   )
//   R.render(ele, container);
// }
// renderWrap('From R');
const Counter = () => {
  const [state, setState] = R.useState(0);
  return (
    <h1 onClick={() => setState(c => c + 1)}>
    Count: {state}
    </h1>
  )
}
const element = <Counter />
R.render(element, document.getElementById('root'));
