Pod::Spec.new do |s|
  s.name             = 'WLAgentSkillsSDK'
  s.version          = '1.0.0'
  s.summary          = 'WLAgentSkills iOS SDK for Skill Server'
  s.description      = 'iOS SDK for interacting with Skill Server, providing skill execution, session management, and real-time messaging.'
  s.homepage         = 'https://github.com/example/WLAgentSkillsSDK'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'Author' => 'author@example.com' }
  s.source           = { :git => 'https://github.com/example/WLAgentSkillsSDK.git', :tag => s.version.to_s }
  s.platform         = :ios, '12.0'
  s.source_files     = 'Classes/**/*.{h,m}'
  s.public_header_files = 'Include/**/*.h'
  s.frameworks       = 'Foundation', 'UIKit'
  s.dependency       'AFNetworking', '~> 4.0'
  s.dependency       'SocketRocket', '~> 0.7'
end