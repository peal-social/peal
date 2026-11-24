// The smoke test, which scripts/test.ts runs against a stand-in API: the
// health check, the credential check with a bearer token, and the error a
// refused token raises.
package social.peal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import social.peal.core.PealClientApiException;
import social.peal.types.Credential;
import social.peal.types.CredentialApiKey;
import social.peal.types.Permission;

class SmokeTest {
    private static final String BASE_URL = System.getenv("PEAL_API_URL");

    @Test
    void callsTheApiWithItsToken() {
        PealClient peal = PealClient.builder().url(BASE_URL).token("peal_test").build();

        peal.system().health();
        Credential credential = peal.credential().get();

        assertTrue(credential.isApiKey(), credential.toString());
        CredentialApiKey key = credential.getApiKey().get();
        assertEquals("Studio", key.getWorkspace().getName());
        assertFalse(key.getExpiresAt().isPresent());
        assertFalse(key.getStart().isPresent());
        assertTrue(key.getPermissions().contains(Permission.POST_SCHEDULE));

        PealClient refused = PealClient.builder().url(BASE_URL).token("refused").build();
        PealClientApiException error =
                assertThrows(PealClientApiException.class, () -> refused.credential().get());
        assertEquals(401, error.statusCode());
    }
}
