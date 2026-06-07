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
		registryDir  = flag.String("registry-dir", filepath.Join(workDir, "registry"), "directory to write the Weaver registry output")
		inventoryDir = flag.String("inventory-dir", filepath.Join(root, "ecosystem-registry", "go", "contrib"), "directory to write the versioned instrumentation inventory")
	)
	flag.Parse()

	if err := run(log, *baseDir, *registryDir, *inventoryDir); err != nil {
		log.WithErrorMsg(err, "sync failed")
		os.Exit(1)
	}
}

func run(log *conf.Log, baseDir, registryDir, inventoryDir string) error {
	log.Info("🔭OTel Ecosystem Explorer: Golang 🔭")

	semconvPath, err := repo.CheckoutSemconv(baseDir)
	if err != nil {
		log.WithErrorMsg(err, "Error checking out semantic conventions")
	} else if err := instrumentation.LoadSemconv(semconvPath); err != nil {
		log.WithErrorMsg(err, "Error loading semantic conventions")
	}

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
	} else if err := syncVersion(log, baseDir, registryDir, mgr, releaseTag, releaseTag, false); err != nil {
		return err
	}

	return syncVersion(log, baseDir, registryDir, mgr, mainBranch, snapshotVersion, true)
}

// syncVersion checks the contrib repo out at ref, scans it into fused Library
// records with per-module versions resolved from the tags at that commit, and
// writes the versioned inventory. The Weaver dev registry is regenerated from
// the same scan. Snapshot writes first clean up the prior snapshot.
func syncVersion(log *conf.Log, baseDir, registryDir string, mgr *inventory.Manager, ref, version string, snapshot bool) error {
	repoInfo, err := repo.CheckoutAt(baseDir, ref)
	if err != nil {
		return err
	}

	result, err := instrumentation.ScanRepo(repoInfo.Name, repoInfo.Path)
	if err != nil {
		return err
	}

	tags, err := repo.TagsAt(repoInfo.Path)
	if err != nil {
		return err
	}
	instrumentation.ApplyModuleVersions(result.Libraries, instrumentation.ModuleVersions(tags))

	if err := instrumentation.Generate(registryDir, result.Groups); err != nil {
		return err
	}

	if snapshot {
		if _, err := mgr.CleanupSnapshots(); err != nil {
			return err
		}
	}
	if err := mgr.Save(version, result.Libraries); err != nil {
		return err
	}

	log.Info("Inventory written 📦",
		"version", version,
		"ref", ref,
		"sha", repoInfo.SHA,
		"libraries", len(result.Libraries),
		"groups", len(result.Groups),
	)
	return nil
}
