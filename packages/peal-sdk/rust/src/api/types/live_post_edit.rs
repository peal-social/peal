pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct LivePostEdit {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<RichText>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<TargetOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub part: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip)]
    pub wait: Option<String>,
}

impl LivePostEdit {
    pub fn builder() -> LivePostEditBuilder {
        <LivePostEditBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct LivePostEditBuilder {
    body: Option<RichText>,
    options: Option<TargetOptions>,
    part: Option<i64>,
    text: Option<String>,
    wait: Option<String>,
}

impl LivePostEditBuilder {
    pub fn body(mut self, value: RichText) -> Self {
        self.body = Some(value);
        self
    }

    pub fn options(mut self, value: TargetOptions) -> Self {
        self.options = Some(value);
        self
    }

    pub fn part(mut self, value: i64) -> Self {
        self.part = Some(value);
        self
    }

    pub fn text(mut self, value: impl Into<String>) -> Self {
        self.text = Some(value.into());
        self
    }

    pub fn wait(mut self, value: impl Into<String>) -> Self {
        self.wait = Some(value.into());
        self
    }

    /// Consumes the builder and constructs a [`LivePostEdit`].
    pub fn build(self) -> Result<LivePostEdit, BuildError> {
        Ok(LivePostEdit {
            body: self.body,
            options: self.options,
            part: self.part,
            text: self.text,
            wait: self.wait,
        })
    }
}
