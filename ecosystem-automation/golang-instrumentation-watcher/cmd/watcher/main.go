// Command watcher scans upstream repositories and writes a versioned
// instrumentation inventory into the ecosystem registry.
//
// It inventories two versions per run: the latest bare release tag and a
// snapshot of the main branch. The release is skipped when it has already been
// inventoried.
//
// Usage:
//
//	watcher [-base-dir dir]
//
// The -base-dir flag sets the directory under which the upstream repositories
// are cloned (into .repo); it defaults to the working directory.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/conf"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/instrumentation"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/inventory"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/repo"
)

const mainBranch = "main"

type ParserStrategy string

const (
	ParserGoMod    ParserStrategy = "gomod"
	ParserMetadata ParserStrategy = "metadata"
)

type Target struct {
	URL      string
	Strategy ParserStrategy
}

var targets = []Target{
	{
		URL:      "https://github.com/open-telemetry/opentelemetry-go-contrib.git",
		Strategy: ParserGoMod,
	},
	{
		URL:      "https://github.com/open-telemetry/opentelemetry-go-compile-instrumentation.git",
		Strategy: ParserMetadata,
	},
	// Other non-otel repos like "https://github.com/alibaba/loongsuite-go.git" could be added here
}

// registryDirForURL returns the registry directory name for a given GitHub repo URL.
// For open-telemetry repos, the "opentelemetry-go-" prefix is stripped from the name.
// For other repos, the name is simply cleaned up by removing slashes and replacing them with hyphens.
func registryDirForURL(repoURL string) string {
	s := strings.TrimPrefix(repoURL, "https://github.com/")
	s = strings.TrimPrefix(s, "git@github.com:")
	s = strings.TrimSuffix(s, ".git")

	if name, ok := strings.CutPrefix(s, "open-telemetry/"); ok {
		if name, ok = strings.CutPrefix(name, "opentelemetry-go-"); ok {
			return name
		}
		return name
	}
	return strings.ReplaceAll(s, "/", "-")
}

// repoRoot walks up from dir until it finds a directory that contains an
// "ecosystem-registry" subdirectory, which is the monorepo root. Returns an
// error if no such ancestor is found.
func repoRoot(dir string) (string, error) {
	current := dir
	for {
		if _, err := os.Stat(filepath.Join(current, "ecosystem-registry")); err == nil {
			return current, nil
		}
		parent := filepath.Dir(current)
		if parent == current {
			return "", fmt.Errorf("could not locate repo root (no ecosystem-registry/ ancestor of %s)", dir)
		}
		current = parent
	}
}

func main() {
	log := conf.NewLog()
	env := conf.NewEnv()

	workDir, err := env.WorkDir()
	if err != nil {
		log.WithErrorMsg(err, "failed to resolve working directory")
		os.Exit(1)
	}

	root, err := repoRoot(workDir)
	if err != nil {
		log.WithErrorMsg(err, "failed to locate repo root")
		os.Exit(1)
	}

	var baseDir = flag.String("base-dir", workDir, "directory under which the upstream repos are cloned (.repo)")
	flag.Parse()

	log.Info("🔭OTel Ecosystem Explorer: Golang 🔭")

	for _, target := range targets {
		inventoryDir := filepath.Join(root, "ecosystem-registry", "go", registryDirForURL(target.URL))

		if err := syncRepo(log, target, *baseDir, inventoryDir); err != nil {
			log.WithErrorMsg(err, "sync failed for target", "url", target.URL)
		}
	}
}

func syncRepo(log *conf.Log, target Target, baseDir, inventoryDir string) error {
	releaseTag, err := repo.LatestReleaseTag(target.URL)
	if err != nil {
		return err
	}
	snapshotVersion, err := inventory.NextSnapshot(releaseTag)
	if err != nil {
		return err
	}

	mgr := inventory.NewManager(inventoryDir)

	if mgr.VersionExists(releaseTag) {
		log.Info("Release already inventoried ⏭️", "version", releaseTag, "url", target.URL)
	} else if err := syncVersion(log, target, baseDir, mgr, releaseTag, releaseTag, false); err != nil {
		return err
	}

	return syncVersion(log, target, baseDir, mgr, mainBranch, snapshotVersion, true)
}

func syncVersion(log *conf.Log, target Target, baseDir string, mgr *inventory.Manager, ref, version string, snapshot bool) error {
	repoInfo, err := repo.CheckoutAt(target.URL, baseDir, ref)
	if err != nil {
		return err
	}

	var result *instrumentation.ScanResult

	switch target.Strategy {
	case ParserGoMod:
		result, err = instrumentation.ScanRepo(repoInfo.Path)
	case ParserMetadata:
		result, err = instrumentation.ScanMetadataRepo(repoInfo.Path)
	default:
		return fmt.Errorf("unknown parser strategy: %v", target.Strategy)
	}

	if err != nil {
		return err
	}

	tags, err := repo.TagsAt(repoInfo.Path)
	if err != nil {
		return err
	}

	// Apply module versions.
	instrumentation.ApplyModuleVersions(result.Libraries, instrumentation.ModuleVersions(tags))

	if err := mgr.Save(version, result.Libraries); err != nil {
		return err
	}
	if snapshot {
		if _, err := mgr.CleanupSnapshotsExcept(version); err != nil {
			return err
		}
	}

	log.Info("Inventory written 📦",
		"url", target.URL,
		"version", version,
		"ref", ref,
		"sha", repoInfo.SHA,
		"libraries", len(result.Libraries),
	)
	return nil
}
