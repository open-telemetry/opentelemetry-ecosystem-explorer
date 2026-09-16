// Package inventory stores fused instrumentation records as a versioned,
// content-addressed inventory on disk.
//
// A [Manager] reads and writes [Inventory] envelopes under a flat,
// version-named directory layout. Versions are validated and ordered with the
// helpers [IsValidVersion], [IsSnapshot], and [NextSnapshot], and inventory
// contents are content-addressed via [ContentHash].
package inventory

import (
	"bytes"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/instrumentation"
)

// FileFormat is the inventory schema version emitted by the Go watcher and
// recorded in each [Inventory]. Go starts its own lineage at 0.1, independent
// of the Java watcher's format.
const FileFormat = 0.1

// fileName is the inventory file written under each version directory.
const fileName = "instrumentation.yaml"

// Inventory is the versioned inventory envelope consumed by explorer-db-builder.
// FileFormat records the [FileFormat] the envelope was written with.
type Inventory struct {
	FileFormat float64                   `yaml:"file_format"`
	Libraries  []instrumentation.Library `yaml:"libraries"`
}

// Manager stores fused [instrumentation.Library] records as a versioned
// [Inventory] under a flat directory layout:
// inventoryDir/v{version}/instrumentation.yaml. It ports the Python
// BaseInventoryManager and InventoryManager mechanics.
type Manager struct {
	inventoryDir string
}

// NewManager returns a Manager rooted at inventoryDir (e.g.
// "ecosystem-registry/go/contrib").
func NewManager(inventoryDir string) *Manager {
	return &Manager{inventoryDir: inventoryDir}
}

// VersionDir returns the directory path for a specific version (with the "v"
// prefix already present in version).
func (m *Manager) VersionDir(version string) string {
	return filepath.Join(m.inventoryDir, version)
}

// ListVersions returns all stored versions sorted newest-to-oldest. Directories
// whose names fail [IsValidVersion] are skipped.
func (m *Manager) ListVersions() ([]string, error) {
	entries, err := os.ReadDir(m.inventoryDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var versions []string
	for _, entry := range entries {
		if entry.IsDir() && IsValidVersion(entry.Name()) {
			versions = append(versions, entry.Name())
		}
	}
	sortVersionsDesc(versions)
	return versions, nil
}

// ListSnapshotVersions returns the stored snapshot (prerelease) versions,
// newest-to-oldest, as identified by [IsSnapshot].
func (m *Manager) ListSnapshotVersions() ([]string, error) {
	versions, err := m.ListVersions()
	if err != nil {
		return nil, err
	}
	var snapshots []string
	for _, v := range versions {
		if IsSnapshot(v) {
			snapshots = append(snapshots, v)
		}
	}
	return snapshots, nil
}

// ListReleaseVersions returns the stored release (non-prerelease) versions,
// newest-to-oldest.
func (m *Manager) ListReleaseVersions() ([]string, error) {
	versions, err := m.ListVersions()
	if err != nil {
		return nil, err
	}
	var releases []string
	for _, v := range versions {
		if !IsSnapshot(v) {
			releases = append(releases, v)
		}
	}
	return releases, nil
}

// CleanupSnapshots removes all snapshot version directories reported by
// [Manager.ListSnapshotVersions] and returns the number removed.
func (m *Manager) CleanupSnapshots() (int, error) {
	snapshots, err := m.ListSnapshotVersions()
	if err != nil {
		return 0, err
	}
	count := 0
	for _, snapshot := range snapshots {
		if err := os.RemoveAll(m.VersionDir(snapshot)); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// CleanupSnapshotsExcept removes all snapshot version directories except keep,
// returning the number removed.
func (m *Manager) CleanupSnapshotsExcept(keep string) (int, error) {
	snapshots, err := m.ListSnapshotVersions()
	if err != nil {
		return 0, err
	}
	count := 0
	for _, snapshot := range snapshots {
		if snapshot == keep {
			continue
		}
		if err := os.RemoveAll(m.VersionDir(snapshot)); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// VersionExists reports whether the version directory and its inventory file
// both exist.
func (m *Manager) VersionExists(version string) bool {
	if _, err := os.Stat(filepath.Join(m.VersionDir(version), fileName)); err != nil {
		return false
	}
	return true
}

// DeleteVersion removes a version directory, returning true if it existed.
func (m *Manager) DeleteVersion(version string) (bool, error) {
	dir := m.VersionDir(version)
	if _, err := os.Stat(dir); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	if err := os.RemoveAll(dir); err != nil {
		return false, err
	}
	return true, nil
}

// Save writes libraries as a versioned [Inventory] at
// inventoryDir/v{version}/instrumentation.yaml, stamped with [FileFormat].
func (m *Manager) Save(version string, libraries []instrumentation.Library) error {
	dir := m.VersionDir(version)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	inv := Inventory{FileFormat: FileFormat, Libraries: libraries}
	data, err := marshalYAML(inv)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, fileName), data, 0644)
}

// Load reads the versioned [Inventory] for version. A missing inventory yields
// an empty envelope stamped with [FileFormat].
func (m *Manager) Load(version string) (Inventory, error) {
	path := filepath.Join(m.VersionDir(version), fileName)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Inventory{FileFormat: FileFormat, Libraries: []instrumentation.Library{}}, nil
		}
		return Inventory{}, err
	}
	var inv Inventory
	if err := yaml.Unmarshal(data, &inv); err != nil {
		return Inventory{}, err
	}
	return inv, nil
}

func marshalYAML(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	if err := enc.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
