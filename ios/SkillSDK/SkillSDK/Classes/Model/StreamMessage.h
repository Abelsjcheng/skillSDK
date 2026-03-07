//
//  StreamMessage.h
//  SkillSDK
//
//  Created on 2026/03/07.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, StreamMessageType) {
    StreamMessageTypeDelta = 0,
    StreamMessageTypeDone = 1,
    StreamMessageTypeError = 2,
    StreamMessageTypeAgentOffline = 3,
    StreamMessageTypeAgentOnline = 4
};

@interface StreamMessage : NSObject

@property (nonatomic, copy, nullable) NSString *sessionId;
@property (nonatomic, assign) StreamMessageType type;
@property (nonatomic, assign) NSInteger seq;
@property (nonatomic, copy, nullable) id content;
@property (nonatomic, copy, nullable) NSDictionary *usage;

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;
- (NSDictionary *)toDictionary;

+ (StreamMessageType)typeFromString:(NSString *)typeString;
+ (NSString *)stringFromType:(StreamMessageType)type;

@end

NS_ASSUME_NONNULL_END
