package repo

import (
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func requireGit(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}
}

func setupGitRepo(t *testing.T, tmpDir string, cmds [][]string) {
	t.Helper()
	for _, cmd := range cmds {
		c := exec.Command(cmd[0], cmd[1:]...)
		c.Dir = tmpDir
		// Isolate from the developer's global/system git config so commits don't
		// inherit settings like commit.gpgsign (SSH/GPG signing), which would make
		// `git commit` fail or block on a key in these hermetic tests.
		c.Env = append(os.Environ(),
			"GIT_CONFIG_GLOBAL=/dev/null",
			"GIT_CONFIG_SYSTEM=/dev/null",
		)
		if err := c.Run(); err != nil {
			t.Fatalf("failed to run %v: %v", cmd, err)
		}
	}
}

func TestName(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want string
	}{
		{"github ssh url", "git@github.com:open-telemetry/opentelemetry-go.git", "opentelemetry-go"},
		{"github https url", "https://github.com/open-telemetry/opentelemetry-go.git", "opentelemetry-go"},
		{"no .git extension", "git@github.com:open-telemetry/opentelemetry-go", "opentelemetry-go"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := name(tt.url); got != tt.want {
				t.Errorf("name(%q) = %q, want %q", tt.url, got, tt.want)
			}
		})
	}
}

func TestExists(t *testing.T) {
	tmpDir := t.TempDir()
	file := filepath.Join(tmpDir, "test.txt")
	if err := os.WriteFile(file, []byte("test"), 0644); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		path string
		want bool
	}{
		{"existing directory", tmpDir, true},
		{"existing file", file, true},
		{"nonexistent path", filepath.Join(tmpDir, "does-not-exist"), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := exists(tt.path); got != tt.want {
				t.Errorf("exists(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}

func TestInfo(t *testing.T) {
	t.Run("returns commit info from git repo", func(t *testing.T) {
		requireGit(t)
		tmpDir := t.TempDir()
		setupGitRepo(t, tmpDir, [][]string{
			{"git", "init"},
			{"git", "config", "user.email", "test@example.com"},
			{"git", "config", "user.name", "Test User"},
			{"git", "commit", "--allow-empty", "-m", "Initial commit"},
		})
		repoInfo, err := info(tmpDir)
		if err != nil {
			t.Fatalf("info() error = %v", err)
		}
		if repoInfo.Head == "" {
			t.Error("info() Head is empty")
		}
		if repoInfo.SHA == "" {
			t.Error("info() SHA is empty")
		}
		if repoInfo.Message != "Initial commit" {
			t.Errorf("info() Message = %q, want %q", repoInfo.Message, "Initial commit")
		}
	})

	t.Run("returns error for non-git directory", func(t *testing.T) {
		if _, err := info(t.TempDir()); err == nil {
			t.Error("info() expected error for non-git directory, got nil")
		}
	})

	t.Run("flattens multiline commit messages", func(t *testing.T) {
		requireGit(t)
		tmpDir := t.TempDir()
		setupGitRepo(t, tmpDir, [][]string{
			{"git", "init"},
			{"git", "config", "user.email", "test@example.com"},
			{"git", "config", "user.name", "Test User"},
			{"git", "commit", "--allow-empty", "-m", "First line\nSecond line"},
		})
		repoInfo, err := info(tmpDir)
		if err != nil {
			t.Fatalf("info() error = %v", err)
		}
		if repoInfo.Message != "First line Second line" {
			t.Errorf("info() Message = %q, want %q", repoInfo.Message, "First line Second line")
		}
	})
}

func TestClone(t *testing.T) {
	requireGit(t)
	if err := clone("invalid-url", t.TempDir()); err == nil {
		t.Error("clone() expected error for invalid url, got nil")
	}
}

func TestLatestReleaseTag(t *testing.T) {
	tests := []struct {
		name string
		tags []string
		want string
	}{
		{
			name: "picks highest stable from mixed list",
			tags: []string{
				"v1.42.0",
				"v1.44.0",
				"v1.43.0",
				"v1.45.0-rc.1", // prerelease, ignored
				"instrumentation/net/http/otelhttp/v0.69.0", // per-module, ignored
				"zpages/v0.69.0", // per-module, ignored
				"not-a-tag",      // invalid, ignored
			},
			want: "v1.44.0",
		},
		{
			name: "returns empty when only per-module tags",
			tags: []string{"zpages/v0.69.0"},
			want: "",
		},
		{
			name: "returns empty for empty input",
			want: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := latestReleaseTag(tt.tags); got != tt.want {
				t.Errorf("latestReleaseTag() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTagsAt(t *testing.T) {
	requireGit(t)
	tmpDir := t.TempDir()
	setupGitRepo(t, tmpDir, [][]string{
		{"git", "init"},
		{"git", "config", "user.email", "test@example.com"},
		{"git", "config", "user.name", "Test User"},
		{"git", "commit", "--allow-empty", "-m", "release"},
		{"git", "tag", "v1.44.0"},
		{"git", "tag", "zpages/v0.69.0"},
	})
	tags, err := TagsAt(tmpDir)
	if err != nil {
		t.Fatalf("TagsAt() error = %v", err)
	}
	got := make(map[string]bool)
	for _, tag := range tags {
		got[tag] = true
	}
	if !got["v1.44.0"] || !got["zpages/v0.69.0"] {
		t.Errorf("TagsAt() = %v, want both v1.44.0 and zpages/v0.69.0", tags)
	}
}

func TestCheckout(t *testing.T) {
	requireGit(t)
	tmpDir := t.TempDir()
	setupGitRepo(t, tmpDir, [][]string{
		{"git", "init", "-b", "main"},
		{"git", "config", "user.email", "test@example.com"},
		{"git", "config", "user.name", "Test User"},
		{"git", "commit", "--allow-empty", "-m", "tagged commit"},
		{"git", "tag", "v1.44.0"},
		{"git", "commit", "--allow-empty", "-m", "later commit"},
	})
	taggedSHA, err := gitCommand(tmpDir, "rev-parse", "v1.44.0")
	if err != nil {
		t.Fatal(err)
	}
	if err := checkout(tmpDir, "v1.44.0"); err != nil {
		t.Fatalf("checkout(tag) error = %v", err)
	}
	head, _ := gitCommand(tmpDir, "rev-parse", "HEAD")
	if head != taggedSHA {
		t.Errorf("after checkout tag, HEAD = %s, want %s", head, taggedSHA)
	}
}

func TestRepoInfoLogValue(t *testing.T) {
	ri := RepoInfo{Name: "opentelemetry-go-contrib", Head: "abc1234", SHA: "abc12345", Message: "test commit"}
	val := ri.LogValue()
	if val.Kind() != slog.KindGroup {
		t.Fatalf("LogValue() kind = %v, want Group", val.Kind())
	}
	attrs := make(map[string]string)
	for _, a := range val.Group() {
		attrs[a.Key] = a.Value.String()
	}
	for key, want := range map[string]string{
		"name":    ri.Name,
		"head":    ri.Head,
		"sha":     ri.SHA,
		"message": ri.Message,
	} {
		if got := attrs[key]; got != want {
			t.Errorf("LogValue() attr %q = %q, want %q", key, got, want)
		}
	}
}
