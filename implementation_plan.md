# Role Architecture Overhaul

## Summary

Complete redesign of the platform's role system. The existing 3-role model (`STUDENT`, `PROCTOR`, `ADMIN`) is replaced with a new 3-role model:

| New Role | Maps From | Responsibilities |
|---|---|---|
| **ADMIN** | *(new)* | Creates & manages TEACHER accounts only. Can view/manage all users. |
| **TEACHER** | old ADMIN + old PROCTOR | Creates exams, assigns other teachers as invigilators. Full control over exams they created. Read-only invigilator access for exams they're assigned to (not created). |
| **STUDENT** | STUDENT | Unchanged |

Key insight: **Invigilator is not a separate role** — it's a TEACHER whose relationship to an exam is "assigned" rather than "creator". The `exam_proctors` table already models this; we just rename and restrict who can be assigned (any TEACHER instead of only PROCTOR).

> [!IMPORTANT]
> **Data migration**: All existing `PROCTOR` users → `TEACHER`. All existing `ADMIN` users → need to decide: keep as ADMIN or promote to TEACHER. Since old ADMIN did exam management (teacher work), they should become TEACHER. You will need a new seed/manual step to create the new ADMIN account.

> [!WARNING]
> **Breaking change**: Any existing `ADMIN`-role JWT tokens will no longer grant exam-management access after Phase 1. All admin users must re-login once the migration is applied.

---

## Phase 1 — Database & Backend Core (Role Enum + Migration)

### Backend — `modules/user`

#### [MODIFY] [User.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/user/User.java)
- Change enum: `STUDENT, PROCTOR, ADMIN` → `STUDENT, TEACHER, ADMIN`

#### [NEW] Migration SQL
- New file: `V23__rename_proctor_to_teacher.sql`
  ```sql
  -- Rename enum value (Postgres requires recreating the type)
  ALTER TYPE user_role RENAME VALUE 'PROCTOR' TO 'TEACHER';
  -- Old ADMIN users become TEACHER (they did exam management)
  UPDATE users SET role = 'TEACHER' WHERE role = 'ADMIN';
  -- Insert a default ADMIN account (superuser)
  INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
  VALUES (gen_random_uuid(), 'Platform Admin', 'admin@gbu.ac.in',
          '<bcrypt-hash-of-admin123>', 'ADMIN', true, now())
  ON CONFLICT DO NOTHING;
  ```
  > [!CAUTION]
  > The bcrypt hash must be generated and hardcoded, or the admin account must be created manually after migration. I'll use a known hash for `admin123` as placeholder — **change this in production**.

---

## Phase 2 — Backend Security & Authorization

### [MODIFY] [SecurityConfig.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/config/SecurityConfig.java)
- Replace `ADMIN` → `TEACHER` for exam/question/enrollment endpoints
- New `ADMIN` role only covers `/api/users` management endpoints
- Add path for teacher creating exams: `POST /api/exams` → `hasRole('TEACHER')`

### [MODIFY] [ExamController.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/exam/ExamController.java)
- `@PreAuthorize("hasRole('ADMIN')")` → `"hasRole('TEACHER')"` on create/update/delete

### [MODIFY] [QuestionController.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/question/QuestionController.java)
- `hasRole('ADMIN')` → `hasRole('TEACHER')`

### [MODIFY] [EnrollmentController.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/enrollment/EnrollmentController.java)
- `hasRole('ADMIN')` → `hasRole('TEACHER')`
- `hasAnyRole('ADMIN','PROCTOR')` → `hasRole('TEACHER')`

### [MODIFY] [SessionController.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/session/ExamSessionController.java)
- `hasAnyRole('ADMIN','PROCTOR')` → `hasRole('TEACHER')`

### [MODIFY] [ProctoringController.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/proctoring/ProctoringController.java)
- `hasAnyRole('ADMIN','PROCTOR')` → `hasRole('TEACHER')`

### [MODIFY] [ExamProctorController.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/proctoring/ExamProctorController.java)
- Assign/unassign invigilator: `hasRole('TEACHER')` (only exam creator can assign — service-layer check)
- View assigned exams: `hasRole('TEACHER')`
- `hasRole('PROCTOR')` → `hasRole('TEACHER')`

### [MODIFY] [UserController.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/user/UserController.java)
- Keep `hasRole('ADMIN')` on all user-management endpoints (unchanged — ADMIN still manages users)
- Add endpoint: `POST /api/users/teachers` — ADMIN creates a TEACHER account

### [MODIFY] [UserService.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/user/UserService.java)
- [changeUserRole](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/user/UserService.java#122-129): ADMIN cannot be assigned via API (only DB seed). ADMIN can change TEACHER↔STUDENT.
- Guard against demoting the last ADMIN.

---

## Phase 3 — Backend Service Logic (Invigilator vs Creator)

This is the key new business logic: a TEACHER's access to an exam depends on **whether they created it**.

### [MODIFY] [ExamProctorService.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/proctoring/ExamProctorService.java)
- Rename concept: `proctor` → `invigilator` in code/comments
- `assignProctor()`: validate that the user being assigned has role `TEACHER` (was `PROCTOR`)
- `verifyAccess()`: 
  - ADMIN → always allowed
  - TEACHER who **created** the exam → always allowed
  - TEACHER who is **assigned as invigilator** → allowed (read-only proctoring)
  - TEACHER who is **neither** → throw `UnauthorizedAccessException`

### [MODIFY] [ExamService.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/exam/ExamService.java)
- `createExam()`: set `createdBy = currentUser` (if not already)
- `updateExam()` / `deleteExam()`: check `exam.createdBy == currentUser || currentUser.role == ADMIN`

### [MODIFY] [AuthService.java](file:///home/lucky/Downloads/exam-platform/backend/src/main/java/com/gbu/examplatform/modules/auth/AuthService.java)
- Student self-registration stays (`STUDENT` role)
- New method: `createTeacherAccount(request, creatorAdmin)` — only callable by ADMIN
- Remove ability to self-register as PROCTOR/ADMIN

---

## Phase 4 — Frontend: Types, Routes & Core Components

### [MODIFY] [types/index.ts](file:///home/lucky/Downloads/exam-platform/frontend/src/types/index.ts)
```diff
- export type UserRole = 'STUDENT' | 'PROCTOR' | 'ADMIN'
+ export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN'
```
- Rename `proctorId`/`proctorName` in [ExamProctorAssignment](file:///home/lucky/Downloads/exam-platform/frontend/src/types/index.ts#125-129) → `teacherId`/`teacherName`

### [MODIFY] [App.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/App.tsx)
- Remove `/proctor` routes
- Add `/teacher` routes (replaces both `/admin` exam routes and `/proctor` routes)
- Keep `/admin` route for user management only
- Route logic: `TEACHER` → `/teacher`; `ADMIN` → `/admin`; `STUDENT` → `/student`

### [MODIFY] [Header.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/components/layout/Header.tsx)
- Replace `PROCTOR` entry with `TEACHER` in `roleConfig`
- Update redirect logic

### [MODIFY] [Profile.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/student/Profile.tsx)
- Replace `PROCTOR` role badge with `TEACHER`

### [MODIFY] [api/proctorAssignment.ts](file:///home/lucky/Downloads/exam-platform/frontend/src/api/proctorAssignment.ts)
- Rename file concept: `assignInvigilator`, `unassignInvigilator`, `getInvigilatorsForExam`, `getExamsForTeacher`

### [MODIFY] [Login.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/auth/Login.tsx)
- Update redirect: `PROCTOR` → `TEACHER`

---

## Phase 5 — Frontend: Pages & UI

### [MODIFY] [AdminDashboard.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/admin/AdminDashboard.tsx)
- Strip out exam management UI
- Focus on: Create Teacher, List Teachers, Deactivate/Reactivate users, Role changes

### [NEW] [pages/teacher/TeacherDashboard.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/teacher/TeacherDashboard.tsx)
- Two-section layout:
  - **My Exams** (created by me) — full management controls (edit, delete, manage enrollments, assign invigilators)
  - **Invigilation Duty** (assigned to me as invigilator) — read-only monitoring panel

### [NEW] [pages/teacher/TeacherExamManage.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/teacher/TeacherExamManage.tsx)
- Same as old [ExamManage.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/admin/ExamManage.tsx) but tabs renamed: `Invigilators` instead of `Proctors`
- Uses `assignInvigilator` API

### [MODIFY] [pages/admin/ManageProctors.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/admin/ManageProctors.tsx)
- Rename → `ManageInvigilators.tsx`
- Label changes: "Proctor" → "Invigilator", "Assign Proctor" → "Assign Invigilator"

### [MODIFY] [pages/proctor/InvigilateExam.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/proctor/InvigilateExam.tsx)
- Move to `pages/teacher/InvigilateExam.tsx`
- No functional changes — same UI, accessible to any TEACHER for their assigned exams

### [MODIFY] [pages/proctor/ProctorDashboard.tsx](file:///home/lucky/Downloads/exam-platform/frontend/src/pages/proctor/ProctorDashboard.tsx)
- Removed — functionality absorbed into `TeacherDashboard.tsx`

---

## Verification Plan

### Manual Testing (after all 5 phases)

**As ADMIN:**
1. Login with `admin@gbu.ac.in` / `admin123`
2. Go to `/admin` — should see User Management only (no exam creation)
3. Create a new Teacher account → should appear in user list with `TEACHER` role
4. Attempt to access `/teacher` → should be redirected to `/admin`

**As TEACHER (exam creator):**
1. Login as a teacher
2. Go to `/teacher` → see "My Exams" section
3. Create an exam → appears under "My Exams" with full controls (edit/delete/assign invigilators)
4. Assign another teacher as invigilator via email
5. Access `/teacher/exams/:id/manage` → all tabs available

**As TEACHER (invigilator only):**
1. Login as the teacher assigned as invigilator
2. Go to `/teacher` → See exam under "Invigilation Duty" section (no edit/delete controls)
3. Access invigilate view → should see session monitoring
4. Attempt to edit the exam → should be blocked (403)

**As STUDENT:**
1. Login as any student → `/student` works as before
2. Register new account → still works (STUDENT role only)

### Database Verification
```bash
docker exec exam-postgres psql -U examuser -d examdb \
  -c "SELECT email, role FROM users ORDER BY role;"
```
- Should show no `PROCTOR` rows; old proctors now show `TEACHER`
- Should show old admins as `TEACHER`
- Should show one `ADMIN` row (`admin@gbu.ac.in`)
