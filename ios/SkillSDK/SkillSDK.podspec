Pod::Spec.new do |s|
  s.name             = 'SkillSDK'
  s.version          = '1.0.0'
  s.summary          = 'Skill SDK for iOS - 提供技能执行、会话管理、消息发送等核心功能'

  s.description      = <<-DESC
Skill SDK 是一个为 iOS 应用提供的技能执行 SDK，支持技能执行、会话管理、消息发送等核心功能。
提供统一的 API 接口，支持 WebSocket 实时通信，适用于 AI 助手、代码分析等场景。
                       DESC

  s.homepage         = 'https://github.com/opencode/skill-sdk'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'OpenCode Team' => 'support@opencode.com' }
  s.source           = { :git => 'https://github.com/opencode/skill-sdk.git', :tag => s.version.to_s }

  s.ios.deployment_target = '11.0'
  s.swift_version = '5.0'

  s.source_files = 'SkillSDK/Classes/**/*.{h,m}'
  
  s.public_header_files = 'SkillSDK/Classes/**/*.h'
  
  s.dependency 'AFNetworking', '~> 4.0'
  s.dependency 'SocketRocket', '~> 0.6.0'
  
  s.frameworks = 'Foundation', 'UIKit'
  
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
end
