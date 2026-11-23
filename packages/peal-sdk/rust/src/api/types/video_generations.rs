pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq, Hash)]
pub struct VideoGenerations {
    #[serde(default)]
    pub generations: Vec<VideoGeneration>,
}

impl VideoGenerations {
    pub fn builder() -> VideoGenerationsBuilder {
        <VideoGenerationsBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct VideoGenerationsBuilder {
    generations: Option<Vec<VideoGeneration>>,
}

impl VideoGenerationsBuilder {
    pub fn generations(mut self, value: Vec<VideoGeneration>) -> Self {
        self.generations = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`VideoGenerations`].
    /// This method will fail if any of the following fields are not set:
    /// - [`generations`](VideoGenerationsBuilder::generations)
    pub fn build(self) -> Result<VideoGenerations, BuildError> {
        Ok(VideoGenerations {
            generations: self
                .generations
                .ok_or_else(|| BuildError::missing_field("generations"))?,
        })
    }
}
