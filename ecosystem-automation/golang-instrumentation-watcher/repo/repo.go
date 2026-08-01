// Package repo clones and checks out the upstream OpenTelemetry repositories
// that the watcher scans.
package repo

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/mod/semver"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/conf"
)

const (
	cwd   = ".repo"
	perms = 0755

	// RepoContrib is the upstream opentelemetry-go-contrib repository name.
	RepoContrib = "opentelemetry-go-contrib"
)

var repos = []string{
	"https://github.com/open-telemetry/opentelemetry-go-contrib.git",
}

// RepoInfo identifies a checked-out repository and its current commit. It is
// returned by [CheckoutAt].
type RepoInfo struct {
	Name    string // repository name (e.g. "opentelemetry-go-contrib")
	Path    string // absolute filesystem path to the checkout
	Head    string // short SHA of the checked-out commit
	SHA     string // full commit SHA
	Message string // commit message subject line
}

// LogValue renders the [RepoInfo] as a [slog.Value] group for structured logging.
func (r RepoInfo) LogValue() slog.Value {
	return slog.GroupValue(
		slog.String("name", r.Name),
		slog.String("head", r.Head),
		slog.String("sha", r.SHA),
		slog.String("message", r.Message),
	)
}

func name(url string) string {
	name := filepath.Base(url)
	return strings.TrimSuffix(name, ".git")
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func clone(url, dir string) error {
	cmd := exec.Command("git", "clone", url)
	cmd.Dir = dir
	return cmd.Run()
}

func fetch(path string) error {
	cmd := exec.Command("git", "fetch", "--tags", "--force", "origin")
	cmd.Dir = path
	return cmd.Run()
}

// checkout moves the working tree to ref. A bare release tag (vX.Y.Z) detaches
// HEAD at that tag; any other ref is treated as a branch and hard-reset to its
// freshly fetched remote tip.
func checkout(path, ref string) error {
	if _, err := gitCommand(path, "checkout", ref); err != nil {
		return err
	}
	if !semver.IsValid(ref) {
		if _, err := gitCommand(path, "reset", "--hard", "origin/"+ref); err != nil {
			return err
		}
	}
	return nil
}

func gitCommand(repoPath string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repoPath
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func info(path string) (*RepoInfo, error) {
	head, err := gitCommand(path, "rev-parse", "--short", "HEAD")
	if err != nil {
		return nil, err
	}

	sha, err := gitCommand(path, "log", "-1", "--format=%H")
	if err != nil {
		return nil, err
	}

	msg, err := gitCommand(path, "log", "-1", "--format=%s")
	if err != nil {
		return nil, err
	}

	return &RepoInfo{
		Head:    head,
		SHA:     sha,
		Message: strings.ReplaceAll(msg, "\n", " "),
	}, nil
}

// CheckoutAt ensures opentelemetry-go-contrib is cloned under baseDir/.repo and
// checks the working tree out at ref (a bare release tag like "v1.44.0" or a
// branch like "main"), returning the resolved [RepoInfo].
func CheckoutAt(baseDir, ref string) (*RepoInfo, error) {
	log := conf.NewLog()

	cloneDir := filepath.Join(baseDir, cwd)
	if err := os.MkdirAll(cloneDir, perms); err != nil {
		log.WithErrorMsg(err, "Failed to create clone directory", "dir", cloneDir)
		return nil, err
	}

	url := repos[0]
	repoName := name(url)
	repoPath := filepath.Join(cloneDir, repoName)

	if !exists(repoPath) {
		if err := clone(url, cloneDir); err != nil {
			log.WithErrorMsg(err, "Failed to clone repo", "repo", repoName)
			return nil, err
		}
	}
	if err := fetch(repoPath); err != nil {
		log.WithErrorMsg(err, "Failed to fetch repo", "repo", repoName)
		return nil, err
	}
	if err := checkout(repoPath, ref); err != nil {
		log.WithErrorMsg(err, "Failed to checkout ref", "repo", repoName, "ref", ref)
		return nil, err
	}

	commitInfo, err := info(repoPath)
	if err != nil {
		log.WithErrorMsg(err, "Failed to resolve repo info", "repo", repoName)
		return nil, err
	}

	repoInfo := &RepoInfo{
		Name:    repoName,
		Path:    repoPath,
		Head:    commitInfo.Head,
		SHA:     commitInfo.SHA,
		Message: commitInfo.Message,
	}

	log.Info(repoName, "ref", ref, "info", *repoInfo)
	return repoInfo, nil
}

// LatestReleaseTag returns the latest bare repo-wide release tag of
// opentelemetry-go-contrib (e.g. "v1.44.0") by listing remote tags over git
// (no GitHub API, so no token or rate limit). go-contrib uses dual versioning:
// this bare stable tag is the repo-wide release marker and git checkout ref,
// distinct from the per-module instrumentation tags on the v0.x line.
func LatestReleaseTag() (string, error) {
	tags, err := listRemoteTags(repos[0])
	if err != nil {
		return "", err
	}
	latest := latestReleaseTag(tags)
	if latest == "" {
		return "", fmt.Errorf("no release tag found for %s", name(repos[0]))
	}
	return latest, nil
}

// listRemoteTags returns the tag names advertised by the remote at url.
func listRemoteTags(url string) ([]string, error) {
	cmd := exec.Command("git", "ls-remote", "--tags", "--refs", url)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var tags []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		if _, ref, ok := strings.Cut(line, "refs/tags/"); ok {
			tags = append(tags, ref)
		}
	}
	return tags, nil
}

// latestReleaseTag selects the highest bare, non-prerelease semantic version
// from tags, ignoring per-module tags (those containing a "/").
func latestReleaseTag(tags []string) string {
	var latest string
	for _, tag := range tags {
		if strings.Contains(tag, "/") {
			continue
		}
		if !semver.IsValid(tag) || semver.Prerelease(tag) != "" {
			continue
		}
		if latest == "" || semver.Compare(tag, latest) > 0 {
			latest = tag
		}
	}
	return latest
}

// TagsAt returns all git tags that point at the currently checked-out commit.
func TagsAt(repoPath string) ([]string, error) {
	out, err := gitCommand(repoPath, "tag", "--points-at", "HEAD")
	if err != nil {
		return nil, err
	}
	if out == "" {
		return nil, nil
	}
	return strings.Split(out, "\n"), nil
}
