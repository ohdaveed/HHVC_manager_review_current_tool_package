````markdown
# HHVC_manager_review_current_tool_package Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, coding conventions, and key workflows used in the `HHVC_manager_review_current_tool_package` TypeScript repository. You'll learn how to structure files, write imports/exports, update design specs, and follow the project's testing patterns.

## Coding Conventions

### File Naming

- Use **kebab-case** for all file names.
  - Example:
    ```
    user-profile-manager.ts
    hhvc-config.test.ts
    ```

### Import Style

- Use **relative imports** for all modules.
  - Example:
    ```typescript
    import { calculateScore } from './utils/calculate-score'
    ```

### Export Style

- Use **named exports** instead of default exports.
  - Example:
    ```typescript
    // In user-profile.ts
    export function getUserProfile(id: string) { ... }
    export const PROFILE_STATUS = { ... };

    // In another file
    import { getUserProfile, PROFILE_STATUS } from './user-profile';
    ```

## Workflows

### Update or Correct Design Spec

**Trigger:** When you need to clarify, fix, or update a design specification after its initial creation (e.g., after review or new findings).  
**Command:** `/update-spec`

1. Identify the need for an update or correction in an existing spec.
2. Edit the relevant markdown file in `docs/superpowers/specs/` to reflect the changes.
   - Example:
     ```
     docs/superpowers/specs/user-authentication.md
     ```
3. Commit the changes with a message referencing the correction or update.
   - Example commit message:
     ```
     Fix typo and clarify flow in user-authentication spec
     ```

## Testing Patterns

- **Test files** use the pattern: `*.test.*`
  - Example: `user-profile-manager.test.ts`
- **Testing framework** is not explicitly detected, but tests are colocated with source files or in relevant directories.
- To add a test:
  1. Create a new file following the naming convention.
  2. Write your test cases using the project's chosen framework (check existing test files for style).

## Commands

| Command      | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| /update-spec | Update or correct an existing design specification markdown file |
````
