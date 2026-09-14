// Existing feature checks exercise the workspace independently of authentication.
// This intercepts only the Vite development entrypoint inside test browser sessions.
export async function localWorkspaceFixture(page) {
  await page.route("**/src/main.jsx*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "/src/components/CloudApp.jsx",
      "/src/components/MemberWorkspace.jsx",
    );
    await route.fulfill({ response, body });
  });
}
