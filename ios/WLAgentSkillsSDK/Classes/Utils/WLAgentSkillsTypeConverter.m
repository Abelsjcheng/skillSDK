//
//  WLAgentSkillsTypeConverter.m
//  WLAgentSkillsSDK
//

#import "WLAgentSkillsTypeConverter.h"

@implementation WLAgentSkillsTypeConverter

+ (nullable NSString *)optionalStringFromValue:(nullable id)value {
    if (value == nil || value == [NSNull null]) {
        return nil;
    }

    NSString *text = nil;
    if ([value isKindOfClass:[NSString class]]) {
        text = (NSString *)value;
    } else if ([value isKindOfClass:[NSNumber class]]) {
        text = [(NSNumber *)value stringValue];
    } else if ([value isKindOfClass:[NSDecimalNumber class]]) {
        text = [(NSDecimalNumber *)value stringValue];
    } else {
        return nil;
    }

    NSString *trimmed = [text stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    return trimmed.length > 0 ? trimmed : nil;
}

+ (nullable NSString *)requiredStringFromValue:(nullable id)value
                                    fieldName:(NSString *)fieldName
                                 errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    NSString *converted = [self optionalStringFromValue:value];
    if (converted != nil) {
        return converted;
    }

    if (errorMessage != NULL) {
        *errorMessage = [NSString stringWithFormat:@"%@ is required.", fieldName ?: @"field"];
    }
    return nil;
}

+ (NSInteger)requiredIntegerFromValue:(nullable id)value
                             fieldName:(NSString *)fieldName
                          errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    NSNumber *parsed = [self integerNumberFromValue:value fieldName:fieldName errorMessage:errorMessage];
    if (parsed != nil) {
        return parsed.integerValue;
    }
    if (errorMessage != NULL && *errorMessage == nil) {
        *errorMessage = [NSString stringWithFormat:@"%@ is required.", fieldName ?: @"field"];
    }
    return 0;
}

+ (nullable NSNumber *)optionalIntegerNumberFromValue:(nullable id)value
                                            fieldName:(NSString *)fieldName
                                         errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    return [self integerNumberFromValue:value fieldName:fieldName errorMessage:errorMessage];
}

+ (NSInteger)nonNegativeIntegerFromValue:(nullable id)value
                            defaultValue:(NSInteger)defaultValue
                                fieldName:(NSString *)fieldName
                             errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    NSNumber *parsed = [self integerNumberFromValue:value fieldName:fieldName errorMessage:errorMessage];
    if (parsed == nil) {
        return MAX(defaultValue, 0);
    }
    return MAX(parsed.integerValue, 0);
}

+ (NSInteger)positiveIntegerFromValue:(nullable id)value
                         defaultValue:(NSInteger)defaultValue
                             fieldName:(NSString *)fieldName
                          errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    NSInteger safeDefault = defaultValue > 0 ? defaultValue : 1;
    NSNumber *parsed = [self integerNumberFromValue:value fieldName:fieldName errorMessage:errorMessage];
    if (parsed == nil) {
        return safeDefault;
    }
    return parsed.integerValue > 0 ? parsed.integerValue : safeDefault;
}

+ (nullable NSNumber *)integerNumberFromValue:(nullable id)value
                                     fieldName:(NSString *)fieldName
                                  errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    if (value == nil || value == [NSNull null]) {
        return nil;
    }

    if ([value isKindOfClass:[NSNumber class]]) {
        return (NSNumber *)value;
    }

    if ([value isKindOfClass:[NSString class]]) {
        NSString *trimmed = [(NSString *)value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
        if (trimmed.length == 0) {
            return nil;
        }
        NSScanner *scanner = [NSScanner scannerWithString:trimmed];
        long long parsed = 0;
        if ([scanner scanLongLong:&parsed] && scanner.isAtEnd) {
            return @(parsed);
        }
    }

    if (errorMessage != NULL) {
        *errorMessage = [NSString stringWithFormat:@"%@ must be an integer.", fieldName ?: @"field"];
    }
    return nil;
}

+ (nullable NSArray<NSString *> *)requiredStringArrayFromValue:(nullable id)value
                                                      fieldName:(NSString *)fieldName
                                                   errorMessage:(NSString * _Nullable * _Nullable)errorMessage {
    if (value == nil || value == [NSNull null]) {
        if (errorMessage != NULL) {
            *errorMessage = [NSString stringWithFormat:@"%@ is required.", fieldName ?: @"field"];
        }
        return nil;
    }
    if (![value isKindOfClass:[NSArray class]]) {
        if (errorMessage != NULL) {
            *errorMessage = [NSString stringWithFormat:@"%@ must be a string array.", fieldName ?: @"field"];
        }
        return nil;
    }

    NSMutableArray<NSString *> *result = [NSMutableArray array];
    for (id item in (NSArray *)value) {
        NSString *converted = [self optionalStringFromValue:item];
        if (converted == nil) {
            if (errorMessage != NULL) {
                *errorMessage = [NSString stringWithFormat:@"%@ must contain non-empty strings.", fieldName ?: @"field"];
            }
            return nil;
        }
        [result addObject:converted];
    }

    if (result.count == 0) {
        if (errorMessage != NULL) {
            *errorMessage = [NSString stringWithFormat:@"%@ is required.", fieldName ?: @"field"];
        }
        return nil;
    }
    return [result copy];
}

@end
