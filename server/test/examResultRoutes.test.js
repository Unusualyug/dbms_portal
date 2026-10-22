const test = require("node:test");
const assert = require("node:assert/strict");
const studentRoutes = require("../src/routes/studentRoutes");
const adminRoutes = require("../src/routes/adminRoutes");

function hasRoute(router, method, path) {
  return router.stack.some(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  );
}

test("student Exam Result endpoint is registered on the authenticated student router", () => {
  assert.equal(hasRoute(studentRoutes, "get", "/exam-result"), true);
});

test("admin Exam Result endpoints are registered for assessment, marks and publication management", () => {
  assert.equal(hasRoute(adminRoutes, "get", "/exam-result"), true);
  assert.equal(hasRoute(adminRoutes, "post", "/exam-result"), true);
  assert.equal(hasRoute(adminRoutes, "get", "/exam-result/:id"), true);
  assert.equal(hasRoute(adminRoutes, "patch", "/exam-result/:id"), true);
  assert.equal(hasRoute(adminRoutes, "patch", "/exam-result/:id/marks"), true);
  assert.equal(hasRoute(adminRoutes, "post", "/exam-result/:id/publish"), true);
  assert.equal(
    hasRoute(adminRoutes, "post", "/exam-result/:id/unpublish"),
    true,
  );
  assert.equal(hasRoute(adminRoutes, "delete", "/exam-result/:id"), true);
});
