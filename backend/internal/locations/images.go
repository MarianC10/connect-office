package locations

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// LocationImageList is stored as a JSON array in locations.images.
type LocationImageList []LocationImage

func (l LocationImageList) Value() (driver.Value, error) {
	if l == nil {
		return []byte("[]"), nil
	}
	return json.Marshal([]LocationImage(l))
}

func (l *LocationImageList) Scan(value interface{}) error {
	if value == nil {
		*l = LocationImageList{}
		return nil
	}

	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	default:
		return fmt.Errorf("unsupported images column type %T", value)
	}

	if len(raw) == 0 || string(raw) == "null" {
		*l = LocationImageList{}
		return nil
	}

	// GORM map Updates can persist a single image as an object; normalize to a slice.
	if raw[0] == '{' {
		var one LocationImage
		if err := json.Unmarshal(raw, &one); err != nil {
			return fmt.Errorf("decode images object: %w", err)
		}
		*l = LocationImageList{one}
		return nil
	}

	var items []LocationImage
	if err := json.Unmarshal(raw, &items); err != nil {
		return fmt.Errorf("decode images array: %w", err)
	}
	*l = LocationImageList(items)
	return nil
}

func (l LocationImageList) Slice() []LocationImage {
	return []LocationImage(l)
}
