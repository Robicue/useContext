import { expect } from "chai";
import {
  Context,
  anchor,
  buoy,
  clone,
  factory,
  fork,
  hook,
  isContext,
  mock,
  mockable,
  use,
  useContext,
  util,
} from "./useContext";

describe("useContext hook tests", () => {
  it("complex forking context", () => {
    const iA = () => ({ value: "A" });
    const iB = () => ({ value: "B" });
    const iC = () => ({ value: "C" });
    const iD = buoy(() => ({ value: "D" }));

    const context = useContext();

    expect(context.isUsed(iA)).to.equal(false);
    expect(context.use(iA).value).to.equal("A");
    expect(context.isUsed(iA)).to.equal(true);

    context.use(iA).value = "E";

    expect(context.use(iA).value).to.equal("E");
    expect(context.use(iB).value).to.equal("B");
    expect(iD(context.context).value).to.equal("D");

    iD(context.context).value = "D1";

    // Test forks

    const forkedContext = useContext(context.fork());

    expect(forkedContext.isUsed(iA)).to.equal(true);
    expect(forkedContext.use(iA).value).to.equal("E");

    expect(context.isUsed(iC)).to.equal(false);
    expect(context.use(iC).value).to.equal("C");
    expect(context.isUsed(iC)).to.equal(true);
    expect(context.isInherited(iC)).to.equal(false);

    expect(forkedContext.isUsed(iC)).to.equal(true);
    expect(forkedContext.use(iC).value).to.equal("C");
    expect(forkedContext.isInherited(iC)).to.equal(true);

    forkedContext.use(iC).value = "C2";

    expect(context.use(iC).value).to.equal("C2");

    expect(forkedContext.init(iC).value).to.equal("C");
    expect(forkedContext.isInherited(iC)).to.equal(false);

    forkedContext.use(iC).value = "C3";
    expect(forkedContext.use(iC).value).to.equal("C3");
    expect(context.use(iC).value).to.equal("C2");

    iD(forkedContext.context).value = "D3";
    expect(iD(forkedContext.context).value).to.equal("D3");
    expect(iD(context.context).value).to.equal("D1");

    context.use(iA).value = "F";
    context.use(iC).value = "G";

    forkedContext.use(iB).value = "H";
    forkedContext.use(iC).value = "I";

    expect(context.use(iA).value).to.equal("F");
    expect(context.use(iB).value).to.equal("H");
    expect(context.use(iC).value).to.equal("G");

    expect(forkedContext.use(iA).value).to.equal("F");
    expect(forkedContext.use(iB).value).to.equal("H");
    expect(forkedContext.use(iC).value).to.equal("I");
  });

  it("is context", () => {
    const value = {};

    expect(isContext(value)).to.equal(false);
    useContext(value).use(() => void 0);
    expect(isContext(value)).to.equal(true);
  });

  it("utility hook", () => {
    const useUtil = util(() => {
      let counter = 0;

      return {
        increment() {
          counter++;
        },

        getCounter() {
          return counter;
        },
      };
    });

    const state1 = useUtil();
    const state2 = useUtil();
    const state3 = useUtil({});

    expect(state1.getCounter()).to.eq(0);
    expect(state2.getCounter()).to.eq(0);
    expect(state3.getCounter()).to.eq(0);

    state1.increment();

    expect(state1.getCounter()).to.eq(1);
    expect(state2.getCounter()).to.eq(1);
    expect(state3.getCounter()).to.eq(0);
  });

  it("cyclic forking is not possible", () => {
    function test() {
      const context = {};
      fork(context, context);
    }

    expect(test).to.throw(
      "The parent context and the forked context cannot be the same"
    );
  });

  it("non direct cyclic forking is not possible", () => {
    function test() {
      const context1 = {};
      const context2 = {};
      fork(context1, context2);
      fork(context2, context1);
    }

    expect(test).to.throw("The forked context is already in use");
  });

  it("a context can only be forked once", () => {
    function test() {
      const context1 = {};
      const context2 = {};

      fork(context1, context2);
      fork(context1, context2);
    }

    expect(test).to.throw("The forked context is already in use");
  });

  it("cloned hook has new state", () => {
    const context = {};

    const hookFunction = () => ({ counter: 1 });

    const stateA = anchor(hookFunction)(context);
    stateA.counter = 2;

    const stateB = anchor(hookFunction)(context);
    expect(stateB.counter).to.equal(2);

    const stateC = anchor(clone(hookFunction))(context);
    expect(stateC.counter).to.equal(1);
  });

  it("usage of hook factory", () => {
    const context = {};

    const createHook = factory(() => ({ counter: 1 }));
    const hookA = createHook();

    const stateA = hookA(context);
    stateA.counter = 2;

    const stateB = hookA(context);
    expect(stateB.counter).to.equal(2);

    const hookB = createHook();
    const stateC = hookB(context);
    expect(stateC.counter).to.equal(1);
  });

  it("async hook usage", async () => {
    const context = {};

    const hookA = async (_: Context, counter?: number) => ({ counter });
    const stateA = await use(context, hookA, 4);

    expect(stateA.counter).to.equal(4);
    stateA.counter = 8;

    const stateB = await use(context, hookA);
    expect(stateB.counter).to.equal(8);
  });

  it("async anchor", async () => {
    const context = {};

    const hookA = anchor(async (_, counter?: number) => ({ counter }));
    const stateA = await hookA(context, 4);

    expect(stateA.counter).to.equal(4);
    stateA.counter = 8;

    const stateB = await hookA(context);
    expect(stateB.counter).to.equal(8);
  });

  it("mocking test", () => {
    const context = {};

    const hookA = mockable((_, counter: number) => ({ counter }));

    const stateA = hookA(context, 4);
    expect(stateA.counter).to.equal(4);

    mock(context, hookA, (originalHook, ctx, counter) => ({
      counter: originalHook(ctx, counter).counter + 5,
    }));

    const stateB = hookA(context, 3);
    expect(stateB.counter).to.equal(8);
  });

  it("mocking not supported", () => {
    const context = {};

    const hookA = hook((_, counter?: number) => ({ counter }));

    expect(() => {
      mock(context, hookA, () => ({ counter: 5 }));
    }).to.throw("The function does not support mocking");
  });
});
