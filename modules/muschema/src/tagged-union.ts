import { MuSchema } from './schema';
import { MuWriteStream, MuReadStream } from 'mustreams';

interface TagSchemaPairs {
    [tag:string]:MuSchema<any>;
}

type TagValuePair<Pairs extends TagSchemaPairs> = {
    [T in keyof Pairs]?:Pairs[T]['identity'];
};

enum TargetIs {
    EqualToBase = 0,
    UnequalToBase = 1,
    UnequalToTargetSchemaId = 2,
    EqualToTargetSchemaId = 4,
}

export class MuUnion<UnionSpec extends TagSchemaPairs>
        implements MuSchema<TagValuePair<UnionSpec>> {
    public readonly identity:TagValuePair<UnionSpec>;
    public readonly muType = 'union';
    public readonly muData:UnionSpec;
    public readonly json;

    private _tags:string[];

    constructor (spec:UnionSpec, identityTag?:keyof UnionSpec) {
        this.muData = spec;
        this._tags = Object.keys(spec);

        this.identity = {};
        identityTag && (this.identity[identityTag] = spec[identityTag].identity);

        const data = {};
        Object.keys(spec).forEach((tag) => data[tag] = spec[tag].json);
        this.json = {
            type: 'union',
            identity: this.identity,
            data,
        };
    }

    public alloc (tag?:string) : TagValuePair<UnionSpec> {
        const result = {};
        tag && (result[tag] = this.muData[tag].alloc());
        return result;
    }

    public free (data:TagValuePair<UnionSpec>) {
        const tag = Object.keys(data)[0];
        tag && (this.muData[tag].free(data[tag]));
    }

    public clone<Pair extends TagValuePair<UnionSpec>> (data:Pair) : Pair {
        const result = {};
        const tag = Object.keys(data)[0];
        tag && (result[tag] = this.muData[tag].clone(data));
        return result as Pair;
    }

    public diff (
        base:TagValuePair<UnionSpec>,
        target:TagValuePair<UnionSpec>,
        out:MuWriteStream,
    ) : boolean {
        out.grow(16);

        const HEAD = out.offset;
        ++out.offset;

        let flag = TargetIs.EqualToBase;

        const targetTag = Object.keys(target)[0];
        const targetSchema = this.muData[targetTag];
        if (targetTag === Object.keys(base)[0]) {
            if (targetSchema.diff(base[targetTag], target[targetTag], out)) {
                flag = TargetIs.UnequalToBase;
            }
        } else {
            out.writeUint8(this._tags.indexOf(targetTag));
            if (targetSchema.diff(targetSchema.identity, target[targetTag], out)) {
                flag = TargetIs.UnequalToTargetSchemaId;
            } else {
                flag = TargetIs.EqualToTargetSchemaId;
            }
        }

        if (flag) {
            out.writeUint8At(HEAD, flag);
            return true;
        }
        out.offset = HEAD;
        return false;
    }

    public patch (
        base:TagValuePair<UnionSpec>,
        inp:MuReadStream,
    ) : TagValuePair<UnionSpec> {
        const result = {};

        const flag = inp.readUint8();
        if (flag & TargetIs.UnequalToBase) {
            const tag = Object.keys(base)[0];
            result[tag] = this.muData[tag].patch(base[tag], inp);
        } else if (flag & TargetIs.UnequalToTargetSchemaId) {
            const tag = this._tags[inp.readUint8()];
            result[tag] = this.muData[tag].patch(this.muData[tag].identity, inp);
        } else {
            const tag = this._tags[inp.readUint8()];
            result[tag] = this.muData[tag].clone(this.muData[tag].identity);
        }

        return result;
    }
}
