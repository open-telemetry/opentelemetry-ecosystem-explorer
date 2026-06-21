// Package repo clones and checks out the upstream OpenTelemetry repositories
// that the watcher scans.
package repo

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/mod/semver"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/conf"
)

const (
	cwd       = ".repo"
	perms     = 0755
	shaLength = 8

	// RepoGo, RepoContrib, and RepoSemconv are the upstream repository names.
	RepoGo      = "opentelemetry-go"
	RepoContrib = "opentelemetry-go-contrib"
	RepoSemconv = "semantic-conventions"

	semconvVersion = "1.38.0"
	semconvZipURL  = "https://github.com/open-telemetry/semantic-conventions/archive/refs/tags/v" + semconvVersion + ".zip"
	semconvSubdir  = "model"
)

var repos = []string{
	"git@github.com:open-telemetry/opentelemetry-go-contrib.git",
}

// RepoInfo identifies a checked-out repository and its current commit. It is
// returned by [Checkout] and [CheckoutAt].
type RepoInfo struct {
	Name    string
	Path    string
	Head    string
	SHA     string
	Message string
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

func pull(path string) error {
	cmd := exec.Command("git", "pull", "--rebase")
	cmd.Dir = path
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
		SHA:     sha[:shaLength],
		Message: strings.ReplaceAll(msg, "\n", " "),
	}, nil
}

func sync(url, dir string, log *conf.Log) (*RepoInfo, error) {
	repoName := name(url)
	repoPath := filepath.Join(dir, repoName)

	if exists(repoPath) {
		if err := pull(repoPath); err != nil {
			log.WithErrorMsg(err, "Failed to pull repo", "repo", repoName, "action", "pull")
			return nil, err
		}
	} else {
		if err := clone(url, dir); err != nil {
			log.WithErrorMsg(err, "Failed to clone repo", "repo", repoName, "action", "clone")
			return nil, err
		}
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

	log.Info(repoName, "info", *repoInfo)
	return repoInfo, nil
}

// Checkout clones the upstream opentelemetry-go repositories into baseDir/.repo
// and returns a [RepoInfo] for each. Errors from individual repositories are
// joined and returned alongside the repositories that did sync.
func Checkout(baseDir string) ([]RepoInfo, error) {
	log := conf.NewLog()

	cloneDir := filepath.Join(baseDir, cwd)
	if err := os.MkdirAll(cloneDir, perms); err != nil {
		log.WithErrorMsg(err, "Failed to create clone directory", "dir", cloneDir, "perms", perms)
		return nil, err
	}

	var repoInfos []RepoInfo
	var errs error
	for _, repoURL := range repos {
		repoInfo, err := sync(repoURL, cloneDir, log)
		if err != nil {
			errs = errors.Join(errs, err)
			continue
		}
		repoInfos = append(repoInfos, *repoInfo)
	}
	return repoInfos, errs
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

// CheckoutSemconv downloads the [RepoSemconv] model from the upstream release
// archive into baseDir/.repo and returns the path to the extracted model
// directory.
func CheckoutSemconv(baseDir string) (string, error) {
	log := conf.NewLog()
	log.Info(RepoSemconv, "url", semconvZipURL, "subdir", semconvSubdir)

	cloneDir := filepath.Join(baseDir, cwd)
	semconvDir, err := downloadAndExtractZip(semconvZipURL, semconvSubdir, cloneDir)
	if err != nil {
		return "", fmt.Errorf("failed to download semconv: %w", err)
	}

	return semconvDir, nil
}

// downloadAndExtractZip downloads a ZIP file and extracts a subdirectory.
func downloadAndExtractZip(zipURL, subdir, destDir string) (string, error) {
	resp, err := http.Get(zipURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to download: %s", resp.Status)
	}

	zipData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return "", err
	}

	var extractedPath string
	for _, file := range zipReader.File {
		if !strings.Contains(file.Name, subdir+"/") {
			continue
		}

		targetPath := filepath.Join(destDir, file.Name)
		if file.FileInfo().IsDir() {
			os.MkdirAll(targetPath, perms)
			if extractedPath == "" {
				extractedPath = targetPath
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), perms); err != nil {
			return "", err
		}

		outFile, err := os.Create(targetPath)
		if err != nil {
			return "", err
		}

		rc, err := file.Open()
		if err != nil {
			outFile.Close()
			return "", err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return "", err
		}

		if extractedPath == "" {
			extractedPath = filepath.Dir(targetPath)
		}
	}

	return extractedPath, nil
}
