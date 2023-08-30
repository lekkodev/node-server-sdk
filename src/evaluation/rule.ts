import { CallExpression_Bucket, ComparisonOperator, LogicalOperator, Rule } from '@buf/lekkodev_cli.bufbuild_es/lekko/rules/v1beta3/rules_pb';
import { Value as LekkoValue } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { Value } from '@bufbuild/protobuf';
import { h32 } from 'xxhashjs';
import { ClientContext } from '../context/context';

export default function evaluateRule(rule: Rule | undefined, namespace: string, configName: string, context?: ClientContext): boolean {
    if (!rule) {
        throw new Error('empty rule');
    }
    switch (rule.rule.case) {
    case 'boolConst':
        return rule.rule.value;
    case 'not':
        return !evaluateRule(rule.rule.value, namespace, configName, context);
    case 'logicalExpression': {
        if (rule.rule.value.rules.length == 0) {
            throw new Error('no rules found in logical expression');
        }
        const lo = rule.rule.value.logicalOperator;
        return rule.rule.value.rules
        .map((r) => evaluateRule(r, namespace, configName, context))
        .reduce((prev, curr) => {
            switch (lo) {
            case LogicalOperator.AND:
                return prev && curr;
            case LogicalOperator.OR:
                return prev || curr;
            default:
                throw new Error('unknown logical operator');
            }
        }, lo == LogicalOperator.AND);
    }
    case 'atom': {
        const contextKey = rule.rule.value.contextKey;
        const contextValue = context && context.get(contextKey);
        if (rule.rule.value.comparisonOperator == ComparisonOperator.PRESENT) {
            return contextValue !== undefined;
        }
        if (!contextValue) {
            // All other comparison operators expect the context key to be present. If
			// it is not present, return false.
            return false;
        }
        switch (rule.rule.value.comparisonOperator) {
        case ComparisonOperator.EQUALS:
            return evaluateEquals(rule.rule.value.comparisonValue, contextValue);
        case ComparisonOperator.NOT_EQUALS:
            return !evaluateEquals(rule.rule.value.comparisonValue, contextValue);
        case ComparisonOperator.LESS_THAN:
        case ComparisonOperator.LESS_THAN_OR_EQUALS:
        case ComparisonOperator.GREATER_THAN:
        case ComparisonOperator.GREATER_THAN_OR_EQUALS: 
            return evaluateNumberComparator(rule.rule.value.comparisonOperator, rule.rule.value.comparisonValue, contextValue);
        case ComparisonOperator.CONTAINED_WITHIN:
            return evaluateContainedWithin(rule.rule.value.comparisonValue, contextValue);
        case ComparisonOperator.STARTS_WITH:
        case ComparisonOperator.ENDS_WITH:
        case ComparisonOperator.CONTAINS:
            return evaluateStringComparator(rule.rule.value.comparisonOperator, rule.rule.value.comparisonValue, contextValue);
        }
        throw new Error('unknown comparison operator');
    }
    case 'callExpression': {
        switch (rule.rule.value.function.case) {
        case 'bucket':
            return evaluateBucket(rule.rule.value.function.value, namespace, configName, context);
        }
        throw new Error('unknown function type');
    }
    }
    throw new Error('unknown rule type');
}

// If the hashed config value % 100 <= threshold, it fits in the "bucket".
// In reality, we internally store the threshold as an integer in [0,100000]
// to account for up to 3 decimal places.
// The config value is salted using the namespace, config name, and context key.
function evaluateBucket(bucketF: CallExpression_Bucket, namespace: string, configName: string, context?: ClientContext) : boolean {
    const ctxKey = bucketF.contextKey;
    const value = context && context.get(ctxKey);
    if (!value) {
        // If key is missing in context map, evaluate to false - move to next rule
        return false;
    }
    let bytesBuffer: Buffer;
    switch (value.kind.case) {
    case 'stringValue':
        bytesBuffer = Buffer.from(value.kind.value);
        break;
    case 'intValue': {
        bytesBuffer = Buffer.alloc(8);
        bytesBuffer.writeBigInt64BE(value.kind.value);
        break;
    }
    case 'doubleValue': {
        bytesBuffer = Buffer.alloc(8);
        bytesBuffer.writeDoubleBE(value.kind.value);
        break;
    }
    default: throw new Error('unsupported value type for bucket');
    }
    const bytesFrags: Buffer[] = [
        Buffer.from(namespace),
        Buffer.from(configName),
        Buffer.from(ctxKey),
        bytesBuffer
    ];
    const result = h32(Buffer.concat(bytesFrags), 0);
    return result.toNumber() % 100000 <= bucketF.threshold;
}

function evaluateEquals(ruleVal: Value | undefined, ctxVal: LekkoValue) : boolean {
    if (!ruleVal) {
        throw new Error('value is undefined');
    }
    switch (ruleVal.kind.case) {
    case 'boolValue':
        if (ctxVal.kind.case == 'boolValue') {
            return ruleVal.kind.value == ctxVal.kind.value;
        }
        throw new Error('type mismatch, expecting boolean');
    case 'numberValue':
        if (ctxVal.kind.case == 'doubleValue' || ctxVal.kind.case == 'intValue') {
            return ruleVal.kind.value == ctxVal.kind.value;
        }
        throw new Error('type mismatch, expecting double or int');
    case 'stringValue':
        if (ctxVal.kind.case == 'stringValue') {
            return ruleVal.kind.value == ctxVal.kind.value;
        }
        throw new Error('type mismatch, expecting string');
    }
    throw new Error('unsupported type for equals operator');
}

function evaluateStringComparator(co: ComparisonOperator, ruleVal: Value | undefined, ctxVal: LekkoValue) : boolean {
    const ruleStr = getString(ruleVal);
    const ctxStr = getString(ctxVal);
    switch (co) {
    case ComparisonOperator.STARTS_WITH: return ctxStr.startsWith(ruleStr);
    case ComparisonOperator.ENDS_WITH: return ctxStr.endsWith(ruleStr);
    case ComparisonOperator.CONTAINS: return ctxStr.includes(ruleStr);
    default: throw new Error('unexpected string comparison operator');
    }
}

function getString(v: Value | LekkoValue | undefined) : string {
    if (!v) {
        throw new Error('value is undefined');
    }
    switch (v.kind.case) {
    case 'stringValue': return v.kind.value;
    default: throw new Error('value is not a string');
    }
}

function evaluateNumberComparator(co: ComparisonOperator, ruleVal: Value | undefined, ctxVal: LekkoValue) : boolean {
    const ruleNum = getNumber(ruleVal);
    const ctxNum = getNumber(ctxVal);
    switch (co) {
    case ComparisonOperator.LESS_THAN: return ctxNum < ruleNum;
    case ComparisonOperator.LESS_THAN_OR_EQUALS: return ctxNum <= ruleNum;
    case ComparisonOperator.GREATER_THAN: return ctxNum > ruleNum;
    case ComparisonOperator.GREATER_THAN_OR_EQUALS: return ctxNum >= ruleNum;
    default: throw new Error('unexpected numerical comparison operator');
    }
}

function getNumber(v: Value | LekkoValue | undefined) : number {
    if (!v) {
        throw new Error('value is undefined');
    }
    switch (v.kind.case) {
    case "numberValue": return v.kind.value;
    case "intValue": return Number(v.kind.value);
    case 'doubleValue': return v.kind.value;
    default: throw new Error('value is not a number');
    }
}

function evaluateContainedWithin(ruleVal: Value | undefined, ctxVal: LekkoValue) : boolean {
    if (!ruleVal) {
        throw new Error('value is undefined');
    }
    switch (ruleVal.kind.case) {
    case 'listValue':
        return ruleVal.kind.value.values.some((listElemVal) => evaluateEquals(listElemVal, ctxVal));
    default: throw new Error('type mismatch: expecting list for operator contained within');
    }
}

