//
//  WLAgentSkillsLog.h
//  WLAgentSkillsSDK
//

#import <Foundation/Foundation.h>

// 宿主接入真实日志库后，可在此处替换为对应外部头文件。
#ifndef WLAS_BUNDLE_NAME
#define WLAS_BUNDLE_NAME @"WLAgentSkillsSDK"
#endif

#ifndef WKFLogInfo
#define WKFLogInfo(bundle, format, ...) NSLog((@"[%@][INFO] " format), bundle, ##__VA_ARGS__)
#endif

#ifndef WKFLogError
#define WKFLogError(bundle, format, ...) NSLog((@"[%@][ERROR] " format), bundle, ##__VA_ARGS__)
#endif
