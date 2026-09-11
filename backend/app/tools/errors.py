class MediaToolError(RuntimeError):
    pass


class UploadTooLargeError(MediaToolError):
    pass


class UnsupportedUploadError(MediaToolError):
    pass


class InvalidMediaError(MediaToolError):
    pass


class NoVideoStreamError(MediaToolError):
    pass


class NoAudioStreamError(MediaToolError):
    pass


class InvalidToolOptionError(MediaToolError):
    pass


class InvalidTrimRangeError(MediaToolError):
    pass


class FFmpegUnavailableError(MediaToolError):
    pass


class EncoderUnavailableError(MediaToolError):
    pass


class ProbeFailedError(MediaToolError):
    pass


class ProcessingFailedError(MediaToolError):
    pass


class ProcessingTimeoutError(MediaToolError):
    pass


class MediaIOError(MediaToolError):
    pass
