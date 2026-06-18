package locations

import (
	"encoding/json"
	"testing"
)

func TestLocationImageList_Scan_objectNormalizedToArray(t *testing.T) {
	raw := []byte(`{"id":"img-1","url":"http://example.com/a.jpg"}`)
	var list LocationImageList
	if err := list.Scan(raw); err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != "img-1" {
		t.Fatalf("got %+v", list)
	}
}

func TestLocationImageList_Scan_array(t *testing.T) {
	raw := []byte(`[{"id":"a","url":"http://example.com/a.jpg"}]`)
	var list LocationImageList
	if err := list.Scan(raw); err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("got %+v", list)
	}
}

func TestLocationImageList_Value_alwaysArray(t *testing.T) {
	list := LocationImageList{{ID: "one", URL: "http://example.com/one.jpg"}}
	v, err := list.Value()
	if err != nil {
		t.Fatal(err)
	}
	b, ok := v.([]byte)
	if !ok {
		t.Fatalf("expected []byte, got %T", v)
	}
	if b[0] != '[' {
		t.Fatalf("expected JSON array, got %s", string(b))
	}
	var decoded []LocationImage
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatal(err)
	}
}
