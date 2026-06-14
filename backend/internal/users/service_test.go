package users

import (
	"context"
	"testing"

	"github.com/MarianC10/connect-office/backend/internal/platform/auth"
	"github.com/google/uuid"
)

type fakeStore struct {
	last auth.Principal
	u    User
	err  error
}

func (f *fakeStore) UpsertFromPrincipal(ctx context.Context, p auth.Principal) (User, error) {
	f.last = p
	if f.err != nil {
		return User{}, f.err
	}
	return f.u, nil
}

func (f *fakeStore) GetStripeCustomerID(ctx context.Context, userID uuid.UUID) (string, error) {
	return "", nil
}

func (f *fakeStore) SetStripeCustomerID(ctx context.Context, userID uuid.UUID, customerID string) error {
	return nil
}

func TestService_Me_mapsUser(t *testing.T) {
	uid := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	email := "c@example.com"
	fs := &fakeStore{
		u: User{
			ID:            uid,
			Email:         &email,
			EmailVerified: true,
		},
	}
	svc := NewService(fs)
	p := auth.Principal{UserID: uid, Email: "c@example.com", EmailVerified: true}
	me, err := svc.Me(context.Background(), p)
	if err != nil {
		t.Fatal(err)
	}
	if me.ID != uid.String() || me.Email != "c@example.com" || !me.EmailVerified {
		t.Fatalf("%+v", me)
	}
	if fs.last.UserID != uid {
		t.Fatal("store not called with principal")
	}
}
