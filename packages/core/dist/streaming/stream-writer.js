var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
/**
 * Converts an AsyncGenerator of StreamEvents to an SSE-formatted ReadableStream.
 */
export function streamToSSE(generator) {
    const encoder = new TextEncoder();
    return new ReadableStream({
        async pull(controller) {
            const { value, done } = await generator.next();
            if (done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
            }
            const data = JSON.stringify(value);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        },
        cancel() {
            generator.return(undefined);
        },
    });
}
/**
 * Collects all text deltas from a stream into a single string.
 */
export async function collectStreamText(generator) {
    var _a, e_1, _b, _c;
    let text = '';
    try {
        for (var _d = true, generator_1 = __asyncValues(generator), generator_1_1; generator_1_1 = await generator_1.next(), _a = generator_1_1.done, !_a; _d = true) {
            _c = generator_1_1.value;
            _d = false;
            const event = _c;
            if (event.type === 'text-delta') {
                text += event.delta;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_d && !_a && (_b = generator_1.return)) await _b.call(generator_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return text;
}
/**
 * Creates a TransformStream that adds heartbeat pings to keep SSE connections alive.
 */
export function withHeartbeat(intervalMs = 15000) {
    let timer;
    const encoder = new TextEncoder();
    return new TransformStream({
        start() {
            // Timer started in transform
        },
        transform(chunk, controller) {
            if (!timer) {
                timer = setInterval(() => {
                    controller.enqueue(encoder.encode(': ping\n\n'));
                }, intervalMs);
            }
            controller.enqueue(chunk);
        },
        flush() {
            if (timer)
                clearInterval(timer);
        },
    });
}
