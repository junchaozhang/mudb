import tape = require('tape');
import {
    MuWriteStream,
    MuReadStream,
} from '../../stream';
import {
    MuSchema,
    MuFloat32,
    MuArray,
    MuSortedArray,
    MuVector,
    MuDictionary,
    MuStruct,
    MuUnion,
} from '../index';
import {
    randArray,
    randVec,
} from '../util/random';

function createTest (
    tt:tape.Test,
    schema:MuSchema<any>,
) : (base, target) => void {
    return function (a, b) {
        const out = new MuWriteStream(1);
        if (schema.diff(a, b, out)) {
            tt.notDeepEqual(a, b, 'diff() should imply dissimilarity');
            tt.true(out.offset > 0, 'at least one byte should be written to stream');
            const inp = new MuReadStream(out.bytes());
            tt.deepEqual(schema.patch(a, inp), b, 'patched value should be identical to target');
            tt.equal(inp.offset, inp.length, 'patch() should consume all bytes on stream');
        } else {
            tt.deepEqual(a, b, 'diff() should imply sameness');
            tt.equal(out.offset, 0, 'no bytes should be written to stream');
        }
    };
}

tape('de/serializing array', (t) => {
    function createTestPair (
        tt:tape.Test,
        schema:MuArray<any>,
    ) {
        const test = createTest(tt, schema);
        return function (a, b) {
            test(a, a);
            test(b, b);
            test(a, b);
            test(b, a);
            test([], a);
            test([], b);
        };
    }

    function randNestedArray () {
        const na = new Array(Math.floor(Math.random() * 10));
        for (let i = 0; i < na.length; ++i) {
            na[i] = randArray();
        }
        return na;
    }

    t.test('simple array', (st) => {
        const array = new MuArray(new MuFloat32());
        const testPair = createTestPair(st, array);
        testPair([], [0]);
        testPair([0], [1]);
        for (let i = 0; i < 1000; ++i) {
            testPair(randArray(), randArray());
        }
        st.end();
    });

    t.test('nested array', (st) => {
        const array = new MuArray(
            new MuArray(new MuFloat32()),
        );
        const testPair = createTestPair(st, array);
        testPair([], [[]]);
        testPair([[]], [[], []]);
        testPair([[0]], [[1]]);
        for (let i = 0; i < 1000; ++i) {
            testPair(randNestedArray(), randNestedArray());
        }
        st.end();
    });
});

tape('de/serializing sorted array', (t) => {
    function createTestPair (
        tt:tape.Test,
        schema:MuSortedArray<any>,
    ) {
        const test = createTest(tt, schema);
        return function (a, b) {
            a.sort();
            b.sort();
            test(a, a);
            test(b, b);
            test(a, b);
            test(b, a);
            test([], a);
            test([], b);
        };
    }

    const sortedArray = new MuSortedArray(new MuFloat32());
    const testPair = createTestPair(t, sortedArray);
    testPair([], [0]);
    testPair([0], [1]);
    for (let i = 0; i < 1000; ++i) {
        testPair(randArray(), randArray());
    }
    t.end();
});

tape('de/serializing vector', (t) => {
    function createTestPair (
        tt:tape.Test,
        schema:MuVector<any>,
    ) : (a, b) => void {
        const test = createTest(tt, schema);
        return function (a, b) {
            test(a, a);
            test(b, b);
            test(a, b);
            test(b, a);
        };
    }

    t.test('vec0', (st) => {
        const vector = new MuVector(new MuFloat32(), 0);
        const test = createTest(st, vector);
        const zeroA = vector.alloc();
        const zeroB = vector.alloc();
        test(zeroA, zeroB);
        st.end();
    });

    t.test('vec1', (st) => {
        const vector = new MuVector(new MuFloat32(), 1);
        const testPair = createTestPair(st, vector);
        const zero = vector.alloc();
        testPair(zero, randVec(1));
        for (let i = 0; i < 10; ++i) {
            testPair(randVec(1), randVec(1));
        }
        st.end();
    });

    t.test('vec2', (st) => {
        const vector = new MuVector(new MuFloat32(), 2);
        const testPair = createTestPair(st, vector);
        const zero = vector.alloc();
        testPair(zero, randVec(2));
        for (let i = 0; i < 100; ++i) {
            testPair(randVec(2), randVec(2));
        }
        st.end();
    });

    t.test('vec3', (st) => {
        const vector = new MuVector(new MuFloat32(), 3);
        const testPair = createTestPair(st, vector);
        const zero = vector.alloc();
        testPair(zero, randVec(3));
        for (let i = 0; i < 1000; ++i) {
            testPair(randVec(3), randVec(3));
        }
        st.end();
    });

    t.test('vec10000', (st) => {
        const vector = new MuVector(new MuFloat32(), 10000);
        const testPair = createTestPair(st, vector);
        const zero = vector.alloc();
        testPair(zero, randVec(10000));
        for (let i = 0; i < 10; ++i) {
            testPair(randVec(10000), randVec(10000));
        }
        st.end();
    });
});

tape('de/serializing dictionary', (t) => {

    t.end();
});

tape('de/serializing struct', (t) => {

    t.end();
});

tape('de/serializing union', (t) => {

    t.end();
});
