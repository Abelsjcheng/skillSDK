//
//  SkillMessage.h
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, MessageRole) {
    MessageRoleUser = 0,
    MessageRoleAssistant = 1,
    MessageRoleSystem = 2,
    MessageRoleTool = 3
};

typedef NS_ENUM(NSInteger, ContentType) {
    ContentTypeMarkdown = 0,
    ContentTypeCode = 1,
    ContentTypePlain = 2
};

@interface SkillMessage : NSObject

@property (nonatomic, assign) NSInteger messageId;
@property (nonatomic, assign) NSInteger sessionId;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, assign) MessageRole role;
@property (nonatomic, copy) NSString *content;
@property (nonatomic, assign) ContentType contentType;
@property (nonatomic, copy, nullable) NSString *createdAt;
@property (nonatomic, copy, nullable) NSString *meta;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;

+ (MessageRole)roleFromString:(NSString *)roleString;
+ (NSString *)stringFromRole:(MessageRole)role;

+ (ContentType)contentTypeFromString:(NSString *)contentTypeString;
+ (NSString *)stringFromContentType:(ContentType)contentType;

@end

NS_ASSUME_NONNULL_END
