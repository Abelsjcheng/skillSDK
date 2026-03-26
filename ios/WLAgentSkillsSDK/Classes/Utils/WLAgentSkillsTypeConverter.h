//
//  WLAgentSkillsTypeConverter.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface WLAgentSkillsTypeConverter : NSObject

+ (nullable NSString *)optionalStringFromValue:(nullable id)value;

+ (nullable NSString *)requiredStringFromValue:(nullable id)value
                                    fieldName:(NSString *)fieldName
                                 errorMessage:(NSString * _Nullable * _Nullable)errorMessage;

+ (NSInteger)requiredIntegerFromValue:(nullable id)value
                             fieldName:(NSString *)fieldName
                          errorMessage:(NSString * _Nullable * _Nullable)errorMessage;

+ (NSInteger)nonNegativeIntegerFromValue:(nullable id)value
                            defaultValue:(NSInteger)defaultValue
                                fieldName:(NSString *)fieldName
                             errorMessage:(NSString * _Nullable * _Nullable)errorMessage;

+ (NSInteger)positiveIntegerFromValue:(nullable id)value
                         defaultValue:(NSInteger)defaultValue
                             fieldName:(NSString *)fieldName
                          errorMessage:(NSString * _Nullable * _Nullable)errorMessage;

+ (nullable NSArray<NSString *> *)requiredStringArrayFromValue:(nullable id)value
                                                      fieldName:(NSString *)fieldName
                                                   errorMessage:(NSString * _Nullable * _Nullable)errorMessage;

@end

NS_ASSUME_NONNULL_END
