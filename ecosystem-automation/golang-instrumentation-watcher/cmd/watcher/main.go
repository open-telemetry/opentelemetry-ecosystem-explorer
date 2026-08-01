// Command watcher scans the upstream opentelemetry-go-contrib repository and
// writes a versioned instrumentation inventory into the ecosystem registry.
//
// It inventories two versions per run: the latest bare release tag and a
// snapshot of the main branch. The release is skipped when it has already been
// inventoried.
//
// Usage:
//
//	watcher [-base-dir dir] [-inventory-dir dir]
//
// The -base-dir flag sets the directory under which the upstream repositories
// are cloned (into .repo); it defaults to the working directory. The
// -inventory-dir flag sets the directory to which the versioned inventory is
// written; it defaults to ecosystem-registry/go/contrib under the monorepo root.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/conf"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/instrumentation"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/inventory"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/repo"
)

const mainBranch = "main"

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

	var (
		baseDir      = flag.String("base-dir", workDir, "directory under which the upstream repos are cloned (.repo)")
		inventoryDir = flag.String("inventory-dir", filepath.Join(root, "ecosystem-registry", "go", "contrib"), "directory to write the versioned instrumentation inventory")
	)
	flag.Parse()

	if err := run(log, *baseDir, *inventoryDir); err != nil {
		log.WithErrorMsg(err, "sync failed")
		os.Exit(1)
	}
}

func run(log *conf.Log, baseDir, inventoryDir string) error {
	log.Info("🔭OTel Ecosystem Explorer: Golang 🔭")

	releaseTag, err := repo.LatestReleaseTag()
	if err != nil {
		return err
	}
	snapshotVersion, err := inventory.NextSnapshot(releaseTag)
	if err != nil {
		return err
	}

	mgr := inventory.NewManager(inventoryDir)

	if mgr.VersionExists(releaseTag) {
		log.Info("Release already inventoried ⏭️", "version", releaseTag)
	} else if err := syncVersion(log, baseDir, mgr, releaseTag, releaseTag, false); err != nil {
		return err
	}

	return syncVersion(log, baseDir, mgr, mainBranch, snapshotVersion, true)
}

// syncVersion checks the contrib repo out at ref, scans it into fused Library
// records with per-module versions resolved from the tags at that commit, and
// writes the versioned inventory. Snapshot writes first clean up the prior snapshot.
func syncVersion(log *conf.Log, baseDir string, mgr *inventory.Manager, ref, version string, snapshot bool) error {
	repoInfo, err := repo.CheckoutAt(baseDir, ref)
	if err != nil {
		return err
	}

	result, err := instrumentation.ScanRepo(repoInfo.Path)
	if err != nil {
		return err
	}

	tags, err := repo.TagsAt(repoInfo.Path)
	if err != nil {
		return err
	}
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
		"version", version,
		"ref", ref,
		"sha", repoInfo.SHA,
		"libraries", len(result.Libraries),
	)
	return nil
}
