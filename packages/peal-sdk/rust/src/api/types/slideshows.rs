pub use crate::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Slideshows {
    #[serde(default)]
    pub slideshows: Vec<Slideshow>,
}

impl Slideshows {
    pub fn builder() -> SlideshowsBuilder {
        <SlideshowsBuilder as Default>::default()
    }
}

#[derive(Clone, PartialEq, Default, Debug)]
#[non_exhaustive]
pub struct SlideshowsBuilder {
    slideshows: Option<Vec<Slideshow>>,
}

impl SlideshowsBuilder {
    pub fn slideshows(mut self, value: Vec<Slideshow>) -> Self {
        self.slideshows = Some(value);
        self
    }

    /// Consumes the builder and constructs a [`Slideshows`].
    /// This method will fail if any of the following fields are not set:
    /// - [`slideshows`](SlideshowsBuilder::slideshows)
    pub fn build(self) -> Result<Slideshows, BuildError> {
        Ok(Slideshows {
            slideshows: self
                .slideshows
                .ok_or_else(|| BuildError::missing_field("slideshows"))?,
        })
    }
}
