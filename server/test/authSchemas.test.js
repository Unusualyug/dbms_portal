const test = require("node:test");
const assert = require("node:assert/strict");
const { registerSchema } = require("../src/validators/authSchemas");

const validStudent = {
  name: "Sample Student",
  email: "student@example.edu",
  password: "a-long-test-password-123",
  semester: "3",
  classSection: "X1",
};

test("registration accepts supported semesters including the OS course semester and converts them to numbers", () => {
  for (const semester of ["3", "4", "5"]) {
    const result = registerSchema.safeParse({ ...validStudent, semester });
    assert.equal(result.success, true);
    assert.equal(result.data.semester, Number(semester));
    assert.equal(result.data.classSection, "X1");
  }
});

test("registration rejects semesters and classes outside the offered options", () => {
  assert.equal(
    registerSchema.safeParse({ ...validStudent, semester: "2" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...validStudent, classSection: "Z1" }).success,
    false,
  );
});

test("registration requires a semester and class selection", () => {
  const { semester, classSection, ...missingCohort } = validStudent;
  assert.equal(registerSchema.safeParse(missingCohort).success, false);
});
