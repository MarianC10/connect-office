package locations

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

type HoursOverride struct {
	Closed *bool  `json:"closed,omitempty"`
	Open   string `json:"open,omitempty"`
	Close  string `json:"close,omitempty"`
}

type HoursOverrides map[string]HoursOverride

type HoursOverridesMap HoursOverrides

func (h HoursOverridesMap) Map() HoursOverrides {
	if h == nil {
		return HoursOverrides{}
	}
	return HoursOverrides(h)
}

func (h HoursOverridesMap) Value() (driver.Value, error) {
	m := HoursOverrides(h)
	if m == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(m)
}

func (h *HoursOverridesMap) Scan(value interface{}) error {
	if value == nil {
		*h = HoursOverridesMap{}
		return nil
	}
	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	default:
		return fmt.Errorf("unsupported hours_overrides column type %T", value)
	}
	if len(raw) == 0 || string(raw) == "null" {
		*h = HoursOverridesMap{}
		return nil
	}
	var m HoursOverrides
	if err := json.Unmarshal(raw, &m); err != nil {
		return fmt.Errorf("decode hours_overrides: %w", err)
	}
	if m == nil {
		m = HoursOverrides{}
	}
	*h = HoursOverridesMap(m)
	return nil
}
