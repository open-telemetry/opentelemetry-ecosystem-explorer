package inventory

import (
	"crypto/sha256"
	"encoding/hex"
)

// hashLength is the number of hex characters retained from the SHA-256 digest,
// matching watcher_common.compute_content_hash.
const hashLength = 12

// ContentHash returns the first [hashLength] hex characters of the SHA-256
// digest of content. It mirrors watcher_common.compute_content_hash so that
// content addressing is consistent across the watcher ecosystem.
func ContentHash(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])[:hashLength]
}
