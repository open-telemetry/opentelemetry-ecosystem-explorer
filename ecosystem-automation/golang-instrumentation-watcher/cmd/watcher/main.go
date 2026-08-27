// Command watcher scans upstream repositories and writes a versioned
// instrumentation inventory into the ecosystem registry.
//
// For each target it inventories two versions: the latest bare release tag and
// a snapshot of the main branch. The release is skipped when it has already
// been inventoried. Tagless repositories get a snapshot only.
//
// Usage:
//
//	watcher [-base-dir dir] [-targets file]
//
// The -base-dir flag sets the directory under which the upstream repositories
// are cloned (into .repo); it defaults to the working directory.
package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"

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

// UnmarshalYAML decodes a [ParserStrategy] from its YAML token, returning an
// error if the value is not a recognized strategy.
func (p *ParserStrategy) UnmarshalYAML(value *yaml.Node) error {
	switch ParserStrategy(value.Value) {
	case ParserGoMod, ParserMetadata:
		*p = ParserStrategy(value.Value)
		return nil
	}
	return fmt.Errorf("unknown parser strategy %q: must be one of %q, %q", value.Value, ParserGoMod, ParserMetadata)
}

type Target struct {
	URL      string         `yaml:"url"`
	Strategy ParserStrategy `yaml:"strategy"`
	Branch   string         `yaml:"branch,omitempty"`
}

type TargetsConfig struct {
	Targets []Target `yaml:"targets"`
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

	var (
		baseDir     = flag.String("base-dir", workDir, "directory under which the upstream repos are cloned (.repo)")
		targetsFile = flag.String("targets", "targets.yaml", "path to the targets configuration file")
	)
	flag.Parse()

	log.Info("🔭OTel Ecosystem Explorer: Golang 🔭")

	data, err := os.ReadFile(*targetsFile)
	if err != nil {
		log.WithErrorMsg(err, "failed to read targets file", "file", *targetsFile)
		os.Exit(1)
	}

	var config TargetsConfig
	dec := yaml.NewDecoder(bytes.NewReader(data))
	dec.KnownFields(true)
	if err := dec.Decode(&config); err != nil {
		log.WithErrorMsg(err, "failed to parse targets file", "file", *targetsFile)
		os.Exit(1)
	}

	if len(config.Targets) == 0 {
		log.Warn("No targets found in configuration", "file", *targetsFile)
	}

	failed := false
	for _, target := range config.Targets {
		inventoryDir := filepath.Join(root, "ecosystem-registry", "go", repo.CloneDirName(target.URL))

		if err := syncRepo(log, target, *baseDir, inventoryDir); err != nil {
			log.WithErrorMsg(err, "sync failed for target", "url", target.URL)
			failed = true
		}
	}

	if failed {
		os.Exit(1)
	}
}

func syncRepo(log *conf.Log, target Target, baseDir, inventoryDir string) error {
	branch := target.Branch
	if branch == "" {
		branch = mainBranch
	}

	releaseTag, err := repo.LatestReleaseTag(target.URL)
	if err != nil && !errors.Is(err, repo.ErrNoReleaseTag) {
		return err
	}

	mgr := inventory.NewManager(inventoryDir)

	if releaseTag != "" {
		snapshotVersion, err := inventory.NextSnapshot(releaseTag)
		if err != nil {
			return err
		}

		if mgr.VersionExists(releaseTag) {
			log.Info("Release already inventoried ⏭️", "version", releaseTag, "url", target.URL)
		} else if err := syncVersion(log, target, baseDir, mgr, releaseTag, releaseTag, false); err != nil {
			return err
		}

		return syncVersion(log, target, baseDir, mgr, branch, snapshotVersion, true)
	}

	// No tags found, so just sync the branch as a snapshot
	const snapshotVersion = "v0.0.1-SNAPSHOT"
	return syncVersion(log, target, baseDir, mgr, branch, snapshotVersion, true)
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
	}

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
		"url", target.URL,
		"version", version,
		"ref", ref,
		"sha", repoInfo.SHA,
		"libraries", len(result.Libraries),
	)
	return nil
}
