Pod::Spec.new do |s|
  s.name             = 'SkillSDK'
  s.version          = '1.0.0'
  s.summary          = 'Skill SDK for iOS - Enables skill execution and AI-powered conversations'

  s.description      = <<-DESC
    iOS SDK for Skill service, providing WebSocket and HTTP APIs for:
    - Skill session management (create, close, stop)
    - Real-time AI response streaming
    - Multi-turn conversations
    - Permission confirmation
    - Mini-program control
  DESC

  s.homepage         = 'https://github.com/your-org/skill-sdk-ios'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'Your Team' => 'your-team@example.com' }
  s.source           = { :git => 'https://github.com/your-org/skill-sdk-ios.git', :tag => s.version.to_s }

  s.ios.deployment_target = '12.0'
  s.swift_version = '5.0'
  s.requires_arc = true

  s.source_files = 'ios/Classes/**/*.{h,m}'
  
  s.public_header_files = 'ios/Classes/API/SkillSDK.h',
                          'ios/Classes/Types/SkillSDKTypes.h'

  s.frameworks = 'Foundation'
  
  s.dependency 'SocketRocket', '~> 0.7.0'

end
