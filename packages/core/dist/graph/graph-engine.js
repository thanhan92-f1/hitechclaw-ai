var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
import { randomUUID } from 'node:crypto';
export class GraphEngine {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
    }
    addNode(node) {
        this.nodes.set(node.id, node);
        return this;
    }
    addEdge(from, to, condition) {
        this.edges.push({ from, to, condition });
        return this;
    }
    setEntry(nodeId) {
        if (!this.nodes.has(nodeId))
            throw new Error(`Node "${nodeId}" not found`);
        this.entryNodeId = nodeId;
        return this;
    }
    execute(initialState, options) {
        return __asyncGenerator(this, arguments, function* execute_1() {
            var _a, _b;
            if (!this.entryNodeId)
                throw new Error('No entry node set');
            const maxSteps = (_a = options === null || options === void 0 ? void 0 : options.maxSteps) !== null && _a !== void 0 ? _a : 100;
            const executionId = randomUUID();
            let currentNodeId = this.entryNodeId;
            let state = Object.assign({}, initialState);
            let steps = 0;
            while (currentNodeId && steps < maxSteps) {
                const node = this.nodes.get(currentNodeId);
                if (!node)
                    throw new Error(`Node "${currentNodeId}" not found`);
                const context = {
                    nodeId: currentNodeId,
                    executionId,
                    emit: () => { }, // Can be wired to EventBus
                };
                state = yield __await(node.handler(state, context));
                (_b = options === null || options === void 0 ? void 0 : options.onStep) === null || _b === void 0 ? void 0 : _b.call(options, currentNodeId, state);
                yield yield __await({ nodeId: currentNodeId, state });
                if (node.type === 'end')
                    break;
                // Find next node via edges
                const outEdges = this.edges.filter((e) => e.from === currentNodeId);
                currentNodeId = undefined;
                for (const edge of outEdges) {
                    if (!edge.condition || edge.condition(state)) {
                        currentNodeId = edge.to;
                        break;
                    }
                }
                steps++;
            }
        });
    }
    getNodes() {
        return [...this.nodes.values()];
    }
    getEdges() {
        return [...this.edges];
    }
}
