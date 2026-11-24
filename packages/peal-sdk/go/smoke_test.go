// The smoke test, which scripts/test.ts runs against a stand-in API: the
// health check, the credential check with a bearer token, and the error a
// refused token raises.
package peal_test

import (
	"context"
	"errors"
	"os"
	"slices"
	"testing"

	peal "github.com/peal-social/peal/packages/peal-sdk/go"
	"github.com/peal-social/peal/packages/peal-sdk/go/client"
	"github.com/peal-social/peal/packages/peal-sdk/go/core"
	"github.com/peal-social/peal/packages/peal-sdk/go/option"
)

func TestSmoke(t *testing.T) {
	baseURL := os.Getenv("PEAL_API_URL")
	if baseURL == "" {
		t.Skip("scripts/test.ts sets PEAL_API_URL to its stand-in API")
	}

	ctx := context.Background()
	c := client.NewClient(option.WithBaseURL(baseURL), option.WithToken("peal_test"))

	if err := c.System.Health(ctx); err != nil {
		t.Fatal(err)
	}

	credential, err := c.Credential.Get(ctx)
	if err != nil {
		t.Fatal(err)
	}

	key := credential.APIKey
	if key == nil || key.Workspace == nil || key.Workspace.Name != "Studio" || key.ExpiresAt != nil ||
		key.Start != nil || !slices.Contains(key.Permissions, peal.PermissionPostSchedule) {
		t.Fatalf("unexpected answer: %+v", credential)
	}

	_, err = client.NewClient(option.WithBaseURL(baseURL), option.WithToken("refused")).Credential.Get(ctx)

	var apiError *core.APIError
	if !errors.As(err, &apiError) || apiError.StatusCode != 401 {
		t.Fatalf("a refused token: got %v, want a 401", err)
	}
}
