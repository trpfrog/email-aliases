import { Anchor, Box, Container, Group, Text, ThemeIcon } from "@mantine/core";

export function AppHeader() {
  return (
    <Box component="header" bg="white" py="md" bd="1px solid var(--mantine-color-gray-2)">
      <Container size="lg">
        <Group justify="space-between">
          <Anchor href="/" aria-label="Email Aliases ホーム" underline="never" c="inherit">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" aria-hidden="true">
                @
              </ThemeIcon>
              <Text fw={700} size="lg">
                Email Aliases
              </Text>
            </Group>
          </Anchor>
          <Text size="sm" c="dimmed">
            admin
          </Text>
        </Group>
      </Container>
    </Box>
  );
}
