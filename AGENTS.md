# AGENTS DEVELOPMENT GUIDE - Skill SDK

## Project Structure
This is a cross-platform Skill SDK supporting three major operating systems:
- `android/` - Android SDK (Java/Kotlin)
- `ios/` - iOS SDK (Objective-C/Swift)
- `harmony/` - HarmonyOS SDK (TypeScript/ArkTS)
- SDK provides unified API for skill execution, session management, real-time messaging, etc.

## Platform-Specific Build Commands

### Android 
- Build: `./gradlew build`
- Build specific variant: `./gradlew assembleDebug` or `./gradlew assembleRelease`
- Unit tests: `./gradlew test`
- Instrumentation tests: `./gradlew connectedAndroidTest`
- Single test: `./gradlew test --tests="<test_class>#<test_method>"`
- Lint check: `./gradlew lint`
- Clean: `./gradlew clean`
- Install on device: `./gradlew installDebug`

### iOS
- Setup project for development: 
  ```bash
  pod install
  ```
- Build via xcodebuild: 
  ```bash
  xcodebuild -workspace SkillSDK.xcworkspace -scheme SkillSDK -destination platform=iOS Simulator,name=iPhone\ 14 -configuration Debug build
  ```
- Run tests: 
  ```bash
  xcodebuild -workspace SkillSDK.xcworkspace -scheme SkillSDK -destination platform=iOS\ Simulator,name=iPhone\ 14 test
  ```
- Single test: Use `xcodebuild` with `ONLY_ACTIVE_ARCH=YES` and specific scheme
- Generate documentation: `jazzy` or `appledoc`

### HarmonyOS
- Build project: `hvigor build`
- Release build: `hvigor build --mode release`
- Build for specific device: `hvigor build -p product=default -var=BUILD_TARGET=device`
- Run tests: `hvigor test`
- Test specific module: `hvigor test -p module=moduleName`
- Bundle build: `hvigor bundle`
- Verify signature (release builds): `hvigor verify`

## Linting and Formatting Standards

### Android
- Static analysis: `./gradlew lint` (runs Android lint)
- Dependencies check: `./gradlew dependencyInsight`
- Code quality: `./gradlew ktlintCheck` if using kotiln, `./gradlew checkstyle` if configured
- Format code (auto-fix): `./gradlew ktlintFormat` if using ktlint
- Import order: alphabetical with groups (android.*, java.*, javax.*, com.*)

### iOS
- Use Xcode built-in formatting Ctrl+I (Cmd+Control+I on some keyboards) for individual file
- Use clang-format with Google/Mozilla presets
- Static analyzer: Run "Product" -> "Analyze" or `xcodebuild -workspace SkillSDK.xcworkspace -scheme SkillSDK analyze`
- Lint configuration via `.clang-format` file
- Property attributes order: atomic/nonatomic, strong/weak/assign/copy, readonly/readwrite
- Method group markers: `// MARK: - Initialization`, `// MARK: - Public Interface`, `// MARK: - Private Helpers`

### HarmonyOS
- TypeScript formatter: Use prettier with tsconfig settings
  ```bash
  npx prettier --write src/
  ```
- Type checking and linting: `tsc --noEmit` followed by ESLint:
  ```bash
  npx eslint src/ --ext .ts,.ets --fix
  ```
- Lint all code with TypeScript strict checks
- Use ArkTS formatting as defined in project .editorconfig
- Consistent import aliasing strategy: `import * as namespace` for type collections, deconstructed for specific exports

## Code Style Guidelines

### General Principles (All Platforms)
- Consistent SDK interface design across platforms
- Clear docstring comments for public interfaces
- Error handling with comprehensive error states
- Memory management with automatic reference counting where possible
- Thread-safe operations for concurrent access
- Efficient resource utilization with proper cleanup

### Naming Conventions
- **Variables/Methods/functions:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Class/Struct/Enum Names:** PascalCase
- **Private members:** Prefixed with underscore (where applicable, e.g. `_privateField`)
- **Platform-Consistent Interface:** Same function names, signatures and behaviors across iOS, Android and HarmonyOS
  - Skill execution: `executeSkill`
  - Session management: `closeSkill`, `stopSkill`
  - Messaging: `sendMessage`, `getSessionMessage`, `sendMessageToIM`
  - Permissions: `replyPermission`
  - Status listeners: `onSessionStatus`, `onSkillWecodeStatus`

### Imports Organization
- Group imports by category (standard library, third party, project)
- Sort alphabetically within groups
- Use explicit paths when possible instead of wildcard imports
- No unused imports

#### Java/Kotlin imports:
```java
// Standard libraries
import android.os.Bundle;

// Third-party libraries
import okhttp3.OkHttpClient;
import retrofit2.Call;

// Internal imports
import com.opencode.skill.model.SkillSession;
import com.opencode.skill.constant.SessionStatus;
```

#### Objective-C imports:
```objc
// System frameworks first
@import Foundation;
@import UIKit;

// Framework dependencies
#import <SocketRocket/SocketRocket.h>

// Local SDK files
#import "SkillSDKTypes.h"
#import "SkillSDKConfig.h"
```

#### TypeScript/ArkTS imports:
```typescript
// Node modules
import { someModule } from '@kit.StandardPackage';

// Project modules
import { SkillSession, SkillSDKConfig } from './types';
```

### Type Safety
- **Java:** Use parameterized types (`List<String>` not `List`)
- **Objective-C:** Always use nullability annotations (`nonnull`, `nullable`)
- **TypeScript:** Strict null checks enabled, all methods with return types specified

### Error Handling Standards
Each platform handles SDK errors differently but follows these standards:

- **Android:** All SDK methods expose SkillCallback<T> with `onSuccess(T result)` and `onError(Throwable error)`
- **iOS:** Block-style completion handlers with nullable NSError
- **HarmonyOS:** Async/await promise-style with try/catch and Result types
- Always handle network errors, timeouts, and invalid arguments
- Provide meaningful error codes and messages for troubleshooting

### Formatting Standards

#### Android (Java/Kotlin)
- Line length: 120 characters max
- Indentation: 4 spaces (no tabs)
- Braces: Opening brace at end of line, closing brace on new line
- Space after keywords (`if (condition)`, `while (condition)`)
- Space around operators (`x = y`, `x + y`)

#### iOS (Objective-C)
- Line length: 100 characters max
- Indentation: 2 spaces (no tabs)
- Column alignment on method colons where possible
- One variable declaration per line unless functionally related
- Use modern Obj-C literals when possible

#### HarmonyOS (TypeScript/ArkTS)
- Indentation: 2 spaces (no tabs)
- Quote marks: Single quotes for strings except to avoid escaping
- Trailing commas: Where syntactically allowed
- Arrow functions: Use when this context preservation isn't needed
- Brackets: Consistent spacing inside array and object literals

### Testing Guidelines

#### Android
- JUnit 4/5 for pure logic unit tests
- MockRunner for instrumented Android tests
- Espresso for UI interaction tests if applicable
- Robolectric for isolated Android framework interactions

#### iOS
- XCTest for units and integration
- OCMock or similar framework for dependency injection in tests
- Snapshot testing for UI components if applicable
- Performance tests for network operations and heavy operations

#### HarmonyOS
- Jest for unit tests, with ark jest extensions for native API simulation
- Mock network requests and device-specific APIs
- Performance monitoring through hvigor tools
- Device compatibility through different virtual device configs

### SDK-Specific Development Practices

#### Thread Management
- Operations that may block happen off the main thread
- Callbacks return to main UI thread appropriately
- Async operations are cancellable when possible

#### Resource Management
- WebSocket connections properly managed and closed
- HTTP clients with connection pooling reused effectively
- Cache resources appropriately with size limitations
- Clean up session state properly when disconnected

#### Session Management
- Maintain consistent session lifecycle across platforms:
  - Execute skill creates session
  - Active session allows sending messages
  - Close skill ends session permanently
  - Stop skill pauses activity without ending session
- Session states properly reflect backend status
- Callback notifications for transitions between states

### API Design Consistency
- Method signatures identical across platforms
- Return types equivalent where practical
- Error codes consistent per platform standards
- Asynchronous operations follow each platform's idioms while maintaining functional equivalence

## Git Workflow
- Feature branches from `develop`
- Pull requests against `develop` for merge reviews
- No direct pushes to main/develop
- Meaningful commit messages following semantic style:
  - `feat(platform)`: New platform or functionality
  - `fix(platform)`: Bug fixes
  - `perf(platform)`: Performance improvement
  - `docs(platform)`: Documentation updates
- Keep feature branches reasonably sized for easier review

## Common Development Tasks
- Adding a new feature: Implement API functionally equivalent across all three platforms
- Bug fixing: Verify impact across platforms if API-level change
- Refactoring: Ensure consistency of public interfaces across platforms
- Adding dependencies: Verify cross-platform compatibility or create platform-specific versions